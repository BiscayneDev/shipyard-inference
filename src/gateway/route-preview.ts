import { createHash, randomBytes } from 'node:crypto'
import type { LLMChatParams } from '../types.js'
import type { ModelMetadata } from '../router/candidates.js'
import { estimateCostUsd, DEFAULT_OUTPUT_CAP_TOKENS } from '../router/strategy.js'
import { estimateInputTokens } from '../router/estimate.js'
import type { RoutePreview } from '../router/router.js'

/** Default per-key ceiling for `POST /v1/route` (requests per rolling minute). */
export const DEFAULT_ROUTE_PREVIEW_PER_MINUTE = 60

/**
 * Fixed-window, in-memory per-key limiter. Process-local: a multi-instance
 * deployment gets `limit × instances`. Keys are hashed before storage so raw
 * bearer tokens never sit in the map.
 */
export class RoutePreviewLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>()

  constructor(
    private readonly limitPerMinute: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns seconds until the window resets when over limit, else undefined. */
  take(identity: string): number | undefined {
    const key = createHash('sha256').update(identity).digest('hex')
    const t = this.now()
    if (this.windows.size > 10_000) {
      for (const [k, w] of this.windows) if (t - w.start >= 60_000) this.windows.delete(k)
    }
    let w = this.windows.get(key)
    if (!w || t - w.start >= 60_000) {
      w = { start: t, count: 0 }
      this.windows.set(key, w)
    }
    w.count++
    if (w.count > this.limitPerMinute) return Math.max(1, Math.ceil((w.start + 60_000 - t) / 1000))
    return undefined
  }
}

/** Opaque, unstored id for one preview. */
export function newRouteId(): string {
  return `rte_${randomBytes(9).toString('hex')}`
}

export interface RoutePreviewBody {
  model?: string
  max_tokens?: number
  max_completion_tokens?: number
}

/**
 * Estimated cost of the chosen model for this request. Input = the same
 * token estimate routing uses; output = `max_tokens` when set, else the
 * router's default cap. Unpriced models report `null`, never a fake $0.
 */
export function estimateRoute(
  preview: RoutePreview,
  body: RoutePreviewBody,
): { estimatedCostUsd: number | null; basis: string } {
  const params: LLMChatParams = preview.params
  const inTok = estimateInputTokens(params)
  const outCap = params.maxTokens ?? DEFAULT_OUTPUT_CAP_TOKENS
  const outSource = params.maxTokens !== undefined ? 'from the request max_tokens' : `assumed (no max_tokens set; router default cap ${DEFAULT_OUTPUT_CAP_TOKENS})`
  const meta: ModelMetadata | undefined = preview.decision.meta
  const model = preview.decision.model ?? body.model ?? 'unknown'
  const provider = preview.decision.candidate.id
  if (!meta || !Number.isFinite(meta.inputCostPerMTok) || !Number.isFinite(meta.outputCostPerMTok)) {
    return {
      estimatedCostUsd: null,
      basis: `No declared pricing for ${model} on ${provider}, so no dollar estimate. Preview does not call the model.`,
    }
  }
  const cost = estimateCostUsd(meta, params)
  const basis =
    `${inTok} input tokens estimated from the request text (about 4 characters per token, no tokenizer) at ` +
    `$${meta.inputCostPerMTok}/MTok, plus ${outCap} output tokens ${outSource} at $${meta.outputCostPerMTok}/MTok, ` +
    `using ${model} on ${provider}'s declared pricing. Real output length, cache hits, and failover are not modelled.`
  return { estimatedCostUsd: cost, basis }
}

/** Headers the chat path sets for routing (cost header omitted: a preview is not a charge). */
export function routeHeaders(preview: RoutePreview): Record<string, string> {
  const h: Record<string, string> = {}
  h['x-shipyard-model'] = preview.decision.model ?? ''
  h['x-shipyard-provider'] = preview.decision.candidate.id
  const t = preview.tier
  if (t) {
    h['x-shipyard-tier'] = t.tier
    h['x-shipyard-tier-source'] = t.source
    if (t.clamped && t.decidedTier) h['x-shipyard-tier-decided'] = t.decidedTier
    if (t.confidence !== undefined) h['x-shipyard-jev-confidence'] = String(t.confidence)
  }
  return h
}

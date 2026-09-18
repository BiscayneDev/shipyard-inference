import type {
  DecisionAnswer,
  DecisionProvider,
  DecisionRequest,
  DecisionResponse,
} from './types.js'

/** Error from the OpenRouter decisions API: non-2xx, malformed body, or timeout. */
export class OpenRouterDecisionError extends Error {
  /** HTTP status when the API responded with an error, else 0 (network/timeout). */
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'OpenRouterDecisionError'
    this.status = status
  }
}

export interface OpenRouterDecisionProviderOptions {
  /** OpenRouter API key (sk-or-v1-…). */
  apiKey: string
  /**
   * Model id. OpenRouter exposes TypeSafe's Jev under both a pinned id
   * (`typesafe/jev-1.13`) and a floating alias (`~typesafe/jev-latest`).
   * Default: `~typesafe/jev-latest`.
   */
  model?: string
  /** Injectable fetch (tests, proxies). Defaults to global fetch. */
  fetch?: typeof fetch
  /** Request timeout. Default 10s. */
  timeoutMs?: number
  /** Optional OpenRouter attribution headers. */
  siteUrl?: string
  siteTitle?: string
}

/**
 * OpenRouter-backed decision provider — TypeSafe Jev via the OpenRouter
 * unified API, no TypeSafe early-access key required.
 *
 * OpenRouter exposes a native decisions endpoint (`POST /api/alpha/decisions`)
 * with the same wire shape as TypeSafe's own `/v1/systemone`: `{model, state,
 * questions}` in, typed answers with calibrated probabilities out. Same
 * pricing ($0.042/MTok input, output free), billed through OpenRouter.
 */
export function createOpenRouterDecisionProvider(
  opts: OpenRouterDecisionProviderOptions,
): DecisionProvider {
  const model = opts.model ?? '~typesafe/jev-latest'
  const doFetch = opts.fetch ?? fetch
  const timeoutMs = opts.timeoutMs ?? 10_000

  return {
    id: 'openrouter-decisions',
    models: [model],

    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      try {
        res = await doFetch('https://openrouter.ai/api/alpha/decisions', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            'content-type': 'application/json',
            ...(opts.siteUrl ? { 'http-referer': opts.siteUrl } : {}),
            ...(opts.siteTitle ? { 'x-openrouter-title': opts.siteTitle } : {}),
          },
          body: JSON.stringify({
            model: req.model ?? model,
            state: req.state,
            questions: req.questions,
          }),
          signal: controller.signal,
        })
      } catch (err) {
        throw new OpenRouterDecisionError(
          err instanceof Error && err.name === 'AbortError'
            ? `OpenRouter decisions timed out after ${timeoutMs}ms`
            : `OpenRouter decisions request failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        clearTimeout(timer)
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new OpenRouterDecisionError(
          `OpenRouter decisions error ${res.status}: ${text.slice(0, 500) || res.statusText}`,
          res.status,
        )
      }

      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw new OpenRouterDecisionError('OpenRouter decisions returned a non-JSON body')
      }
      const parsed = body as { model?: unknown; answers?: unknown; usage?: unknown }
      if (!parsed || typeof parsed !== 'object' || !parsed.answers) {
        throw new OpenRouterDecisionError('OpenRouter decisions response missing `answers`')
      }
      const usage = parsed.usage as
        | { input_tokens?: unknown; output_tokens?: unknown }
        | undefined
      return {
        model: typeof parsed.model === 'string' ? parsed.model : model,
        answers: parsed.answers as Record<string, DecisionAnswer>,
        usage:
          usage && typeof usage === 'object'
            ? {
                inputTokens: Number(usage.input_tokens ?? 0),
                outputTokens: Number(usage.output_tokens ?? 0),
              }
            : undefined,
      }
    },
  }
}

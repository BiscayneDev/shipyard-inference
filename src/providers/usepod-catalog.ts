import type { LLMProvider } from '../types.js'
import type { ModelMetadata, ModelTier, ProviderCandidate } from '../router/candidates.js'
import { createUsePodProvider, type UsePodFamily, type UsePodProviderOptions } from './usepod.js'

/**
 * UsePod is a *marketplace* proxy: you pass a model id, and competing providers
 * serve it at a price capped at the cheapest centralized rate for that model
 * (see https://docs.usepod.ai/marketplace/pricing/). The live catalog is
 * enumerable at `GET /proxy/<token>/v1/models`, but only on an activated
 * (funded) token. So the Router learns UsePod's models two ways:
 *
 *   1. **Discover** — `fetchUsePodModels()` reads the live `/v1/models` list.
 *   2. **Curated fallback** — when discovery is unavailable (no balance yet, an
 *      outage), a hand-vetted best-per-tier catalog keeps the candidate routable.
 *
 * Either way the ids are run through {@link classifyUsePodModel} to attach a
 * tier, capabilities, context window, and a *reference* price (the centralized
 * cap — an honest upper bound, since the marketplace only ever charges less).
 * `costOptimized` + `autoTier` then pick the cheapest capable UsePod model per
 * request, exactly as they do for any other candidate.
 */

/** Classification of a single UsePod model id: routing metadata minus the id. */
export interface UsePodModelClass extends Omit<ModelMetadata, 'model'> {
  /** Which proxy surfaces can serve this id. claude speaks Anthropic + OpenAI; everything else is OpenAI-compatible. */
  surfaces: UsePodFamily[]
}

const BOTH: UsePodFamily[] = ['anthropic', 'openai']
const OPENAI: UsePodFamily[] = ['openai']

const TOOLS_JSON = ['tools', 'json']
const TOOLS_JSON_VISION = ['tools', 'json', 'vision']

/**
 * Ordered classification rules (most specific first). Prices are USD per 1M
 * tokens at the *centralized cap* — the marketplace charges at or below this.
 * Matching is case-insensitive against the model id; version suffixes are
 * tolerated (e.g. `claude-sonnet-4-5`, `deepseek-v4`, `qwen-3.5-397b`).
 */
interface ClassRule {
  test: RegExp
  cls: UsePodModelClass
}

const RULES: ClassRule[] = [
  // --- frontier proprietary ---
  {
    test: /claude.*opus/,
    cls: { tier: 'frontier', inputCostPerMTok: 5, outputCostPerMTok: 25, contextWindow: 200_000, capabilities: TOOLS_JSON_VISION, surfaces: BOTH },
  },
  {
    test: /^gpt-?5(\.|-|$)|gpt-5\.5|gpt-?o[0-9]/,
    cls: { tier: 'frontier', inputCostPerMTok: 5, outputCostPerMTok: 15, contextWindow: 256_000, capabilities: TOOLS_JSON_VISION, surfaces: OPENAI },
  },
  {
    test: /gemini.*(pro|ultra)|grok/,
    cls: { tier: 'frontier', inputCostPerMTok: 2.5, outputCostPerMTok: 10, contextWindow: 1_000_000, capabilities: TOOLS_JSON_VISION, surfaces: OPENAI },
  },
  // --- standard ---
  {
    test: /claude.*sonnet/,
    cls: { tier: 'standard', inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 200_000, capabilities: TOOLS_JSON_VISION, surfaces: BOTH },
  },
  {
    test: /gpt-4o(?!-mini)|gpt-4\.1(?!-mini)/,
    cls: { tier: 'standard', inputCostPerMTok: 2.5, outputCostPerMTok: 10, contextWindow: 128_000, capabilities: TOOLS_JSON_VISION, surfaces: OPENAI },
  },
  {
    test: /deepseek/,
    cls: { tier: 'standard', inputCostPerMTok: 0.3, outputCostPerMTok: 1.2, contextWindow: 128_000, capabilities: TOOLS_JSON, surfaces: OPENAI },
  },
  {
    test: /qwen.*(235|397|max|3\.5|72b)|glm-?[56]|kimi/,
    cls: { tier: 'standard', inputCostPerMTok: 0.4, outputCostPerMTok: 1.2, contextWindow: 128_000, capabilities: TOOLS_JSON, surfaces: OPENAI },
  },
  {
    test: /mistral.*(large|medium)|gemini.*flash/,
    cls: { tier: 'standard', inputCostPerMTok: 0.8, outputCostPerMTok: 2.4, contextWindow: 128_000, capabilities: TOOLS_JSON, surfaces: OPENAI },
  },
  // --- economy / commodity open-weight ---
  {
    test: /claude.*haiku/,
    cls: { tier: 'economy', inputCostPerMTok: 0.8, outputCostPerMTok: 4, contextWindow: 200_000, capabilities: TOOLS_JSON_VISION, surfaces: BOTH },
  },
  {
    test: /gpt.*mini|gpt-4o-mini/,
    cls: { tier: 'economy', inputCostPerMTok: 0.15, outputCostPerMTok: 0.6, contextWindow: 128_000, capabilities: TOOLS_JSON_VISION, surfaces: OPENAI },
  },
  {
    test: /llama-?4|llama-?3\.[23]/,
    cls: { tier: 'economy', inputCostPerMTok: 0.1, outputCostPerMTok: 0.3, contextWindow: 128_000, capabilities: TOOLS_JSON_VISION, surfaces: OPENAI },
  },
  {
    test: /mistral.*small|ministral|mixtral/,
    cls: { tier: 'economy', inputCostPerMTok: 0.1, outputCostPerMTok: 0.3, contextWindow: 128_000, capabilities: TOOLS_JSON, surfaces: OPENAI },
  },
  {
    test: /qwen|glm|gemma|phi/,
    cls: { tier: 'economy', inputCostPerMTok: 0.05, outputCostPerMTok: 0.2, contextWindow: 128_000, capabilities: TOOLS_JSON, surfaces: OPENAI },
  },
]

/**
 * Classify a UsePod model id into routing metadata, or `null` if the id matches
 * no known model family (so we never invent a tier/price for something we can't
 * recognize — it simply isn't offered to the cost-ranker).
 */
export function classifyUsePodModel(id: string): UsePodModelClass | null {
  const key = id.toLowerCase()
  for (const { test, cls } of RULES) {
    if (test.test(key)) return cls
  }
  return null
}

/**
 * Curated preference per tier — the model we'd reach for first if it's in the
 * live catalog. Ordered best-first; the first id present (by exact or family
 * match) wins. Override per call via `createUsePodCandidate({ prefer })`.
 */
export const USEPOD_PREFERRED: Record<ModelTier, string[]> = {
  frontier: ['gpt-5.5', 'claude-opus-4-5', 'gemini-2.5-pro'],
  standard: ['claude-sonnet-4-5', 'deepseek-v4', 'deepseek-v3.2', 'qwen-3.5-397b', 'glm-5.1', 'gpt-4o'],
  economy: ['llama-4', 'mistral-small-4', 'claude-haiku-4-5', 'gpt-4o-mini'],
}

const TIER_ORDER: ModelTier[] = ['economy', 'standard', 'frontier']

function toMeta(id: string, cls: UsePodModelClass): ModelMetadata {
  const { surfaces: _surfaces, ...meta } = cls
  return { model: id, ...meta }
}

/** Pick the candidate id from `ids` matching a preferred token (exact, then substring). */
function matchPreferred(ids: string[], preferred: string): string | undefined {
  const lower = ids.map((i) => i.toLowerCase())
  const want = preferred.toLowerCase()
  const exact = lower.indexOf(want)
  if (exact !== -1) return ids[exact]
  const partial = lower.findIndex((i) => i.includes(want) || want.includes(i))
  return partial !== -1 ? ids[partial] : undefined
}

export interface SelectUsePodOptions {
  /** Proxy surface the candidate speaks — filters out ids the surface can't serve. Default 'openai'. */
  family?: UsePodFamily
  /** Per-tier preference override (merged over {@link USEPOD_PREFERRED}). */
  prefer?: Partial<Record<ModelTier, string[]>>
}

/**
 * From a list of available model ids, pick the **best model per tier** (≤ one
 * each of economy / standard / frontier), filtered to ids the chosen surface
 * can serve. Preference order: a curated `prefer`/`USEPOD_PREFERRED` hit, else
 * the cheapest classified model in that tier. Returns `ModelMetadata[]` sorted
 * economy → frontier, ready to drop into a `ProviderCandidate.models`.
 */
export function selectUsePodModels(
  ids: string[],
  options: SelectUsePodOptions = {},
): ModelMetadata[] {
  const family = options.family ?? 'openai'
  const prefer = { ...USEPOD_PREFERRED, ...options.prefer }

  // Classify every servable id once.
  const classified = ids
    .map((id) => ({ id, cls: classifyUsePodModel(id) }))
    .filter((c): c is { id: string; cls: UsePodModelClass } => !!c.cls && c.cls.surfaces.includes(family))

  const out: ModelMetadata[] = []
  for (const tier of TIER_ORDER) {
    const inTier = classified.filter((c) => c.cls.tier === tier)
    if (inTier.length === 0) continue

    // 1) curated preference
    let chosen: { id: string; cls: UsePodModelClass } | undefined
    for (const pref of prefer[tier] ?? []) {
      const id = matchPreferred(inTier.map((c) => c.id), pref)
      if (id) {
        chosen = inTier.find((c) => c.id === id)
        break
      }
    }
    // 2) else cheapest classified model in the tier
    if (!chosen) {
      chosen = [...inTier].sort(
        (a, b) =>
          a.cls.inputCostPerMTok + a.cls.outputCostPerMTok -
          (b.cls.inputCostPerMTok + b.cls.outputCostPerMTok),
      )[0]
    }
    if (chosen) out.push(toMeta(chosen.id, chosen.cls))
  }
  return out
}

/**
 * Curated best-per-tier fallback catalog for a surface — used when the live
 * `/v1/models` list can't be read. Built by running {@link selectUsePodModels}
 * over the top preferred id of each tier, so it stays consistent with discovery.
 */
export function usePodFallbackCatalog(options: SelectUsePodOptions = {}): ModelMetadata[] {
  const prefer = { ...USEPOD_PREFERRED, ...options.prefer }
  // Seed with *all* preferred ids so per-tier selection can fall through to a
  // surface-appropriate model (e.g. the Anthropic surface lands on claude-* even
  // when the top economy/frontier preference is an OpenAI-only open-weight id).
  const seedIds = TIER_ORDER.flatMap((t) => prefer[t] ?? [])
  return selectUsePodModels(seedIds, options)
}

export interface FetchUsePodModelsOptions {
  /** UsePod token (the UUID in the proxy path). Defaults to `USEPOD_TOKEN`. */
  token?: string
  /** Proxy surface to read the listing from. Default 'openai' (`/proxy/<token>/v1/models`). */
  family?: UsePodFamily
  /** Override the proxy base. */
  baseURL?: string
  /** Custom fetch. */
  fetch?: typeof fetch
}

const DEFAULT_PROXY_HOST = 'https://api.usepod.ai/proxy'

/**
 * Read the live model catalog from `GET /proxy/<token>/v1/models`. Returns the
 * raw model id strings UsePod currently serves. Requires an **activated**
 * (funded) token — an unfunded token returns `unauthorized`, which surfaces as
 * a thrown error so callers can fall back to the curated catalog.
 */
export async function fetchUsePodModels(
  options: FetchUsePodModelsOptions = {},
): Promise<string[]> {
  const token = options.token ?? process.env.USEPOD_TOKEN
  if (!token && !options.baseURL) {
    throw new Error(
      '[shipyard-inference] fetchUsePodModels requires `token` (or USEPOD_TOKEN).',
    )
  }
  const base = options.baseURL
    ? options.baseURL.replace(/\/+$/, '')
    : `${DEFAULT_PROXY_HOST}/${token}/v1`
  const f = options.fetch ?? globalThis.fetch
  const res = await f(`${base}/models`)
  if (!res.ok) {
    throw new Error(`[shipyard-inference] UsePod /v1/models failed: ${res.status}`)
  }
  const body = (await res.json()) as { data?: Array<{ id?: string }> } | Array<{ id?: string }>
  const list = Array.isArray(body) ? body : (body.data ?? [])
  return list.map((m) => m?.id).filter((id): id is string => typeof id === 'string')
}

export interface UsePodCandidateOptions extends UsePodProviderOptions {
  /** Candidate id for ordering/observability. Default 'usepod'. */
  id?: string
  /**
   * Read the live `/v1/models` catalog and select best-per-tier from it. When
   * false (or discovery fails), the curated fallback catalog is used. Default true.
   */
  discover?: boolean
  /** Explicit model set — skips discovery and curation entirely. */
  models?: ModelMetadata[]
  /** Per-tier preference override (merged over {@link USEPOD_PREFERRED}). */
  prefer?: Partial<Record<ModelTier, string[]>>
}

/**
 * Build a batteries-included UsePod `ProviderCandidate`: a `createUsePodProvider`
 * paired with a best-per-tier `models[]`, so `Router` + `autoTier` route each
 * request to the cheapest capable UsePod model automatically — no hand-written
 * catalog. Defaults to the OpenAI surface so the full marketplace (open-weight +
 * frontier) is reachable.
 *
 * @example
 *   const usepod = await createUsePodCandidate({ token: process.env.USEPOD_TOKEN })
 *   const router = new Router({ candidates: [usepod], strategy: costOptimized(), autoTier: true })
 */
export async function createUsePodCandidate(
  options: UsePodCandidateOptions = {},
): Promise<ProviderCandidate> {
  const family: UsePodFamily = options.family ?? 'openai'
  const id = options.id ?? 'usepod'
  const provider = createUsePodProvider({ ...options, family })
  const selectOpts: SelectUsePodOptions = { family, prefer: options.prefer }

  if (options.models) return { id, provider, models: options.models }

  if (options.discover !== false) {
    try {
      const ids = await fetchUsePodModels({
        token: options.token,
        family,
        baseURL: options.baseURL,
        fetch: options.fetch,
      })
      const models = selectUsePodModels(ids, selectOpts)
      if (models.length > 0) return { id, provider, models }
      // Empty/unrecognized listing → fall through to curated catalog.
    } catch (err) {
      console.warn(
        `[shipyard-inference] UsePod model discovery failed (${(err as Error).message}); ` +
          'using curated fallback catalog.',
      )
    }
  }

  return { id, provider, models: usePodFallbackCatalog(selectOpts) }
}

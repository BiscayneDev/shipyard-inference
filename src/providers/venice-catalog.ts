import type { LLMProvider, MediaProvider } from '../types.js'
import type { ModelMetadata, ProviderCandidate } from '../router/candidates.js'
import {
  VeniceVideoProvider,
  type VeniceVideoProviderOptions,
} from './venice.js'

/**
 * Venice video model catalog. Venice (https://docs.venice.ai/models/video)
 * offers per-generation video models — text-to-video and image-to-video — priced
 * per 5-second clip at 720p, not per-token. Each entry below is a hand-vetted
 * `ModelMetadata` with `costPerGeneration` set and `inputCostPerMTok`/
 * `outputCostPerMTok`/`contextWindow` zeroed (they're irrelevant for media
 * generation). `mediaType: 'video'` flags these for the router so it doesn't
 * route chat traffic to them.
 *
 * Pricing confirmed Aug 2026 from docs.venice.ai/models/video.
 */

const VIDEO = 'video' as const

function veniceVideo(
  model: string,
  tier: ModelMetadata['tier'],
  costPerGeneration: number,
  capabilities: string[],
): ModelMetadata {
  return {
    model,
    tier,
    costPerGeneration,
    inputCostPerMTok: 0,
    outputCostPerMTok: 0,
    contextWindow: 0,
    mediaType: VIDEO,
    capabilities,
  }
}

/**
 * Full Venice video model catalog, ordered economy → standard → frontier.
 * Prices are USD per 5s @ 720p generation.
 */
export const VENICE_VIDEO_CATALOG: ModelMetadata[] = [
  // --- economy ---
  veniceVideo('gemini-omni-flash-1-1-text-to-video', 'economy', 0.16, ['video', 'text-to-video']),
  veniceVideo('gemini-omni-flash-1-1-image-to-video', 'economy', 0.16, ['video', 'image-to-video']),
  veniceVideo('seedance-2-0-mini-text-to-video', 'economy', 0.38, ['video', 'text-to-video', 'uncensored']),
  veniceVideo('wan-3-0-text-to-video', 'economy', 0.36, ['video', 'text-to-video', 'uncensored']),
  veniceVideo('wan-3-0-image-to-video', 'economy', 0.36, ['video', 'image-to-video', 'uncensored']),
  // --- standard ---
  veniceVideo('wan-3-0-prime-text-to-video', 'standard', 0.51, ['video', 'text-to-video', 'uncensored']),
  veniceVideo('wan-3-0-prime-image-to-video', 'standard', 0.51, ['video', 'image-to-video', 'uncensored']),
  veniceVideo('wan-2-7-text-to-video', 'standard', 0.70, ['video', 'text-to-video', 'uncensored']),
  // --- frontier ---
  veniceVideo('seedance-2-5-text-to-video', 'frontier', 2.06, ['video', 'text-to-video']),
  veniceVideo('seedance-2-0-text-to-video', 'frontier', 3.91, ['video', 'text-to-video']),
]

/**
 * Best value per tier — the model we'd reach for first in each tier.
 * Used as the default `models[]` for {@link createVeniceVideoCandidate}.
 */
export const VENICE_PREFERRED_VIDEO: ModelMetadata[] = [
  // economy: gemini-omni-flash (cheapest at $0.16/gen)
  veniceVideo('gemini-omni-flash-1-1-text-to-video', 'economy', 0.16, ['video', 'text-to-video']),
  // standard: wan-3-0-prime (best quality/cost ratio in standard tier)
  veniceVideo('wan-3-0-prime-text-to-video', 'standard', 0.51, ['video', 'text-to-video', 'uncensored']),
  // frontier: seedance-2-5 (best frontier value at $2.06/gen)
  veniceVideo('seedance-2-5-text-to-video', 'frontier', 2.06, ['video', 'text-to-video']),
]

export interface VeniceVideoCandidateOptions extends VeniceVideoProviderOptions {
  /** Candidate id for ordering/observability. Default 'venice-video'. */
  id?: string
  /** Explicit model set — overrides the default preferred catalog. */
  models?: ModelMetadata[]
}

/**
 * Build a batteries-included Venice video `ProviderCandidate`: a
 * `VeniceVideoProvider` paired with {@link VENICE_PREFERRED_VIDEO} as the
 * default `models[]`, so `Router` + `autoTier` route each video generation
 * request to the best-value Venice model per tier automatically.
 *
 * @example
 *   const candidate = createVeniceVideoCandidate({ apiKey: process.env.VENICE_API_KEY })
 *   const router = new Router({ candidates: [candidate], strategy: costOptimized(), autoTier: true })
 */
export function createVeniceVideoCandidate(
  options: VeniceVideoCandidateOptions = {},
): ProviderCandidate {
  const id = options.id ?? 'venice-video'
  // VeniceVideoProvider implements MediaProvider (video), not LLMProvider.
  // ProviderCandidate.provider is typed as LLMProvider, but for video-only
  // candidates the router casts to MediaProvider when dispatching video calls.
  const provider = new VeniceVideoProvider(options) as unknown as LLMProvider

  const models = options.models ?? VENICE_PREFERRED_VIDEO

  return { id, provider, models }
}

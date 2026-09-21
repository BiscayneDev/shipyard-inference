/**
 * Public model catalog — the data behind `GET /api/catalog` and the `/catalog`
 * portal page. One row per model Shipyard can serve, local (Ollama appliance
 * ladder) or cloud.
 *
 * Ground rules:
 *  - Cloud prices are sourced from `DEFAULT_PRICING` (src/router/pricing.ts) by
 *    reference — numbers are NEVER duplicated here, so the catalog cannot drift
 *    from the router's cost ranking.
 *  - `hardwareFit` is derived from the hardware ladder
 *    (src/connect/hardware.ts: usable VRAM = min(70% RAM, RAM − 6GB)), not
 *    hard-coded: a model is `runs-on-8gb` when the 8GB ladder serves it,
 *    `needs-32gb` when the 32GB ladder does, `needs-64gb` beyond that.
 */
import { DEFAULT_PRICING } from '../router/pricing.js'
import { ladderForHardware, type HardwareProfile } from '../connect/hardware.js'

export type HardwareFit = 'runs-on-8gb' | 'needs-32gb' | 'needs-64gb' | 'cloud-only'

export interface CatalogEntry {
  /** Canonical model id (Ollama tag for local, provider id for cloud). */
  slug: string
  /** Serving provider, e.g. `ollama`, `anthropic`, `openai`, `nous`. */
  provider: string
  /** USD per 1M input tokens (0 for local). */
  inputPerMTok: number
  /** USD per 1M output tokens (0 for local). */
  outputPerMTok: number
  /** Context window in tokens. */
  context: number
  /** Minimum hardware class, derived from the ladder. */
  hardwareFit: HardwareFit
  /** Whether the local appliance ladder can serve it at all. */
  localAvailable: boolean
}

/** Cloud provider attribution for DEFAULT_PRICING keys (display only). */
const CLOUD_PROVIDER: Record<string, string> = {
  'claude-opus-4-5': 'anthropic',
  'claude-sonnet-4-5': 'anthropic',
  'claude-haiku-4-5': 'anthropic',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'Hermes-4-405B': 'nous',
  'Hermes-4-70B': 'nous',
}

/** Synthetic profiles used only to classify fit — never probed. */
const FIT_PROFILES: Array<{ ramGb: number; fit: HardwareFit }> = [
  { ramGb: 8, fit: 'runs-on-8gb' },
  { ramGb: 32, fit: 'needs-32gb' },
  { ramGb: 64, fit: 'needs-64gb' },
]

/**
 * Which hardware class serves a local ladder model? Walks the fit profiles
 * smallest-first and returns the first ladder that includes the model.
 */
export function hardwareFitForLadderModel(slug: string): HardwareFit {
  const profile = (ramGb: number): HardwareProfile => ({
    totalRamGb: ramGb,
    chip: 'classification',
    platform: 'darwin',
  })
  for (const { ramGb, fit } of FIT_PROFILES) {
    if (ladderForHardware(profile(ramGb)).models.some((m) => m.model === slug)) return fit
  }
  return 'needs-64gb'
}

/** Local rows, mirrored from the hardware ladder (sourced, not duplicated). */
function localEntries(): CatalogEntry[] {
  // A 256GB profile surfaces the full hardware CATALOG.
  const ladder = ladderForHardware({ totalRamGb: 256, chip: 'catalog', platform: 'darwin' })
  return ladder.models.map((m) => ({
    slug: m.model,
    provider: 'ollama',
    inputPerMTok: 0,
    outputPerMTok: 0,
    context: m.contextWindow,
    hardwareFit: hardwareFitForLadderModel(m.model),
    localAvailable: true,
  }))
}

/** Cloud rows, priced by reference to DEFAULT_PRICING. */
function cloudEntries(): CatalogEntry[] {
  return Object.entries(DEFAULT_PRICING).map(([slug, meta]) => ({
    slug,
    provider: CLOUD_PROVIDER[slug] ?? 'cloud',
    inputPerMTok: meta.inputCostPerMTok,
    outputPerMTok: meta.outputCostPerMTok,
    context: meta.contextWindow,
    hardwareFit: 'cloud-only' as const,
    localAvailable: false,
  }))
}

/** The public catalog: local ladder first, then the cloud models. */
export const CATALOG: CatalogEntry[] = [...localEntries(), ...cloudEntries()]

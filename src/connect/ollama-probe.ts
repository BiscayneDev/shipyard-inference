import type { LocalLadder, LadderModel } from './hardware.js'

export interface MatchLocalModelsOptions {
  /** Injectable fetch for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Ollama base URL, e.g. 'http://127.0.0.1:11434' (no /v1 suffix). */
  baseUrl: string
  ladder: LocalLadder
}

export interface LocalModelsMatch {
  /** Ladder models that are actually pulled in the local Ollama. */
  available: LadderModel[]
  /** Ladder models the hardware can serve but Ollama hasn't pulled. */
  missing: LadderModel[]
  /** False when the Ollama daemon is unreachable. */
  ollamaUp: boolean
}

/**
 * Compare the hardware ladder against the local Ollama's pulled models
 * (`GET {baseUrl}/api/tags`). Never throws — an unreachable daemon is
 * reported as `ollamaUp: false` with empty results.
 */
export async function matchLocalModels(
  opts: MatchLocalModelsOptions,
): Promise<LocalModelsMatch> {
  const { fetchImpl = fetch, baseUrl, ladder } = opts
  let pulled: Set<string>
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/tags`)
    if (!res.ok) return { available: [], missing: ladder.models, ollamaUp: false }
    const body = (await res.json()) as { models?: Array<{ name: string }> }
    pulled = new Set((body.models ?? []).map((m) => m.name))
  } catch {
    return { available: [], missing: ladder.models, ollamaUp: false }
  }
  const available: LadderModel[] = []
  const missing: LadderModel[] = []
  for (const m of ladder.models) {
    // Ollama tags can carry the same base model under suffixes
    // (llama3.2:3b vs llama3.2:latest); match either exact or
    // base-name-equal ignoring the tag after ':'.
    const base = m.model.split(':')[0]
    const hit =
      pulled.has(m.model) ||
      [...pulled].some((p) => p.split(':')[0] === base)
    ;(hit ? available : missing).push(m)
  }
  return { available, missing, ollamaUp: true }
}

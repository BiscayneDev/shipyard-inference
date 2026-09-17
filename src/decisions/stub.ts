import type {
  DecisionAnswer,
  DecisionProvider,
  DecisionRequest,
  DecisionResponse,
} from './types.js'

export interface StubDecisionProviderOptions {
  /** Label for telemetry. Default `stub`. */
  id?: string
  /** Model id reported in responses. Default `stub-latest`. */
  model?: string
  /**
   * Scripted answers. When provided, used as-is (answers keyed by request
   * question id must line up); otherwise a deterministic neutral handler runs.
   * Useful for tests and for demoing typed-decision consumers without a key.
   */
  handler?: (req: DecisionRequest) => DecisionResponse | Promise<DecisionResponse>
}

/**
 * Deterministic offline decision provider. No API key required — used in
 * tests, local dev, and as a stand-in until a live backend (e.g. TypeSafe
 * early access) is configured.
 *
 * The default handler returns maximally-honest neutral answers:
 *  - choice: first option at uniform probabilities, confidence 0
 *  - score: the ladder midpoint at uniform probabilities, confidence 0
 *  - noul: 0.5 (complete uncertainty)
 * Consumers see the exact wire shape a real provider returns, so threshold and
 * branching logic can be exercised before the backend exists.
 */
export function createStubDecisionProvider(
  opts: StubDecisionProviderOptions = {},
): DecisionProvider & { calls: DecisionRequest[] } {
  const model = opts.model ?? 'stub-latest'
  const calls: DecisionRequest[] = []

  const neutralAnswer = (q: DecisionRequest['questions'][string]): DecisionAnswer => {
    if (q.type === 'choice') {
      const keys = Object.keys(q.criteria)
      const first = keys[0] ?? 'none'
      const probabilities: Record<string, number> = {}
      for (const k of keys) probabilities[k] = keys.length > 0 ? 1 / keys.length : 0
      return { type: 'choice', choice: first, probabilities, confidence: 0 }
    }
    if (q.type === 'score') {
      const legend: Record<string, string> = {}
      const probabilities: Record<string, number> = {}
      q.criteria.forEach((level, i) => {
        legend[String(i)] = level
        probabilities[String(i)] = 1 / q.criteria.length
      })
      const mid = (q.criteria.length - 1) / 2
      return { type: 'score', score: mid, legend, probabilities, confidence: 0 }
    }
    return { type: 'noul', noul: 0.5 }
  }

  return {
    id: opts.id ?? 'stub',
    models: [model],
    calls,
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      calls.push(req)
      if (opts.handler) return await opts.handler(req)
      const answers: Record<string, DecisionAnswer> = {}
      let outputTokens = 0
      for (const [id, q] of Object.entries(req.questions ?? {})) {
        answers[id] = neutralAnswer(q)
        outputTokens += 1
      }
      return {
        model: req.model ?? model,
        answers,
        usage: {
          inputTokens: Math.max(1, Math.ceil(JSON.stringify(req.state ?? '').length / 4)),
          outputTokens,
        },
      }
    },
  }
}

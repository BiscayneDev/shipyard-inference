import type {
  DecisionAnswer,
  DecisionProvider,
  DecisionQuestion,
  DecisionRequest,
  DecisionResponse,
} from './types.js'

/** Error from the Vercel AI Gateway evaluation endpoint. */
export class VercelGatewayDecisionError extends Error {
  /** HTTP status when the gateway responded with an error, else 0. */
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'VercelGatewayDecisionError'
    this.status = status
  }
}

export interface VercelGatewayDecisionProviderOptions {
  /** AI Gateway API key (vck_…, from the Vercel dashboard or `vercel ai-gateway setup`). */
  apiKey: string
  /** Model id on the gateway. Default: `typesafe-ai/jev`. */
  model?: string
  /** Injectable fetch (tests, proxies). Defaults to global fetch. */
  fetch?: typeof fetch
  /** Request timeout. Default 10s. */
  timeoutMs?: number
}

/**
 * Vercel AI Gateway decision provider — TypeSafe Jev via the same Vercel
 * account that hosts the deployment (no new signup, billed with the Vercel
 * invoice; Jev is $0.04/MTok input, output free).
 *
 * Raw contract (captured from the AI SDK's experimental_evaluate):
 *   POST https://ai-gateway.vercel.sh/v4/ai/evaluation-model
 *   headers: ai-evaluation-model-specification-version: 4,
 *            ai-gateway-auth-method: api-key,
 *            ai-gateway-protocol-version: 0.0.1,
 *            ai-model-id: <model>, authorization: Bearer <vck_…>
 *   body: {state, questions: {id: {type: 'boolean'|'choice'|'score', ...}}}
 * The gateway spec calls the yes/no question `boolean` where TypeSafe's
 * native API calls it `noul` — mapped in both directions here.
 */
export function createVercelGatewayDecisionProvider(
  opts: VercelGatewayDecisionProviderOptions,
): DecisionProvider {
  const model = opts.model ?? 'typesafe-ai/jev'
  const doFetch = opts.fetch ?? fetch
  const timeoutMs = opts.timeoutMs ?? 10_000

  // DecisionQuestion (TypeSafe wire) → gateway evaluation spec v4.
  function toGatewayQuestion(q: DecisionQuestion): Record<string, unknown> {
    const out: Record<string, unknown> = {
      type: q.type === 'noul' ? 'boolean' : q.type,
      instructions: q.instructions,
    }
    if (q.type === 'choice') out.criteria = q.criteria
    else if (q.type === 'score') out.criteria = q.criteria
    else if (q.criteria) out.criteria = q.criteria
    return out
  }

  // Gateway answer → DecisionAnswer (tolerant: accept both boolean/noul).
  function fromGatewayAnswer(a: unknown): DecisionAnswer {
    const ans = a as {
      type?: string
      boolean?: unknown
      noul?: unknown
      choice?: string
      probabilities?: Record<string, number>
      confidence?: number
      score?: number
      legend?: Record<string, string>
    }
    if (ans?.type === 'boolean' || typeof ans?.boolean === 'number') {
      const noul = Number(ans.boolean ?? ans.noul ?? 0)
      return { type: 'noul', noul: noul > 1 ? noul / 100 : noul }
    }
    if (ans?.type === 'noul') return { type: 'noul', noul: Number(ans.noul ?? 0) }
    if (ans?.type === 'choice') {
      return {
        type: 'choice',
        choice: ans.choice ?? '',
        probabilities: ans.probabilities ?? {},
        confidence: ans.confidence ?? 0,
      }
    }
    if (ans?.type === 'score') {
      return {
        type: 'score',
        score: Number(ans.score ?? 0),
        legend: ans.legend ?? {},
        probabilities: ans.probabilities ?? {},
        confidence: ans.confidence ?? 0,
      }
    }
    return { type: 'noul', noul: 0.5 }
  }

  return {
    id: 'vercel-gateway-decisions',
    models: [model],

    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const questions: Record<string, Record<string, unknown>> = {}
      for (const [id, q] of Object.entries(req.questions ?? {})) {
        questions[id] = toGatewayQuestion(q)
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      try {
        res = await doFetch('https://ai-gateway.vercel.sh/v4/ai/evaluation-model', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            'content-type': 'application/json',
            'ai-evaluation-model-specification-version': '4',
            'ai-gateway-auth-method': 'api-key',
            'ai-gateway-protocol-version': '0.0.1',
            'ai-model-id': req.model ?? model,
          },
          body: JSON.stringify({ state: req.state, questions }),
          signal: controller.signal,
        })
      } catch (err) {
        throw new VercelGatewayDecisionError(
          err instanceof Error && err.name === 'AbortError'
            ? `Vercel AI Gateway evaluation timed out after ${timeoutMs}ms`
            : `Vercel AI Gateway evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        clearTimeout(timer)
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new VercelGatewayDecisionError(
          `Vercel AI Gateway error ${res.status}: ${text.slice(0, 500) || res.statusText}`,
          res.status,
        )
      }

      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw new VercelGatewayDecisionError('Vercel AI Gateway returned a non-JSON body')
      }
      const parsed = body as {
        answers?: unknown
        usage?: { inputTokens?: number; outputTokens?: number; input_tokens?: number; output_tokens?: number }
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.answers) {
        throw new VercelGatewayDecisionError('Vercel AI Gateway response missing `answers`')
      }
      const answers: Record<string, DecisionAnswer> = {}
      for (const [id, a] of Object.entries(parsed.answers as Record<string, unknown>)) {
        answers[id] = fromGatewayAnswer(a)
      }
      const u = parsed.usage
      return {
        model: req.model ?? model,
        answers,
        usage: u
          ? {
              inputTokens: Number(u.inputTokens ?? u.input_tokens ?? 0),
              outputTokens: Number(u.outputTokens ?? u.output_tokens ?? 0),
            }
          : undefined,
      }
    },
  }
}

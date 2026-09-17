import type {
  DecisionAnswer,
  DecisionProvider,
  DecisionRequest,
  DecisionResponse,
  DecisionQuestion,
} from './types.js'

/** Error from the TypeSafe API: non-2xx, malformed body, or timeout. */
export class TypeSafeError extends Error {
  /** HTTP status when the API responded with an error, else 0 (network/timeout). */
  readonly status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'TypeSafeError'
    this.status = status
  }
}

export interface TypeSafeProviderOptions {
  /** API key from console.typesafe.ai (sent as `Authorization: Bearer …`). */
  apiKey: string
  /** Defaults to `https://api.typesafe.ai`. */
  baseUrl?: string
  /** Default model per request; the wire default is `jev-latest`. */
  model?: string
  /** Injectable fetch (tests, proxies). Defaults to global fetch. */
  fetch?: typeof fetch
  /** Request timeout. Default 10s. */
  timeoutMs?: number
}

/** Wire question shape: identical to {@link DecisionQuestion} plus optional ids. */
type WireQuestion = {
  type: DecisionQuestion['type']
  instructions: string
  criteria?: Record<string, string> | string[] | string
}

/**
 * TypeSafe AI (Jev) provider — the first public System One model.
 *
 * One REST call: `POST {baseUrl}/v1/systemone` with `{ state, model, questions }`,
 * answered in parallel with typed values + calibrated probabilities. Input
 * tokens are ~$0.042/MTok and output tokens are free, so callers may bundle
 * many questions per request at negligible cost.
 */
export function createTypeSafeProvider(opts: TypeSafeProviderOptions): DecisionProvider {
  const baseUrl = (opts.baseUrl ?? 'https://api.typesafe.ai').replace(/\/+$/, '')
  const model = opts.model ?? 'jev-latest'
  const doFetch = opts.fetch ?? fetch
  const timeoutMs = opts.timeoutMs ?? 10_000

  return {
    id: 'typesafe',
    models: [model],

    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const questions: Record<string, WireQuestion> = {}
      for (const [id, q] of Object.entries(req.questions ?? {})) {
        const wire: WireQuestion = { type: q.type, instructions: q.instructions }
        if (q.type === 'choice') wire.criteria = q.criteria
        else if (q.type === 'score') wire.criteria = q.criteria
        else if (q.criteria) wire.criteria = q.criteria
        questions[id] = wire
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      try {
        res = await doFetch(`${baseUrl}/v1/systemone`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            state: req.state,
            model: req.model ?? model,
            questions,
          }),
          signal: controller.signal,
        })
      } catch (err) {
        throw new TypeSafeError(
          err instanceof Error && err.name === 'AbortError'
            ? `TypeSafe request timed out after ${timeoutMs}ms`
            : `TypeSafe request failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      } finally {
        clearTimeout(timer)
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new TypeSafeError(
          `TypeSafe API error ${res.status}: ${text.slice(0, 500) || res.statusText}`,
          res.status,
        )
      }

      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw new TypeSafeError('TypeSafe API returned a non-JSON body')
      }

      const parsed = body as {
        model?: unknown
        answers?: unknown
        usage?: unknown
      }
      if (!parsed || typeof parsed !== 'object' || typeof parsed.answers !== 'object' || !parsed.answers) {
        throw new TypeSafeError('TypeSafe API response missing `answers`')
      }
      const answers = parsed.answers as Record<string, DecisionAnswer>
      const usage = parsed.usage as { input_tokens?: unknown; output_tokens?: unknown } | undefined
      return {
        model: typeof parsed.model === 'string' ? parsed.model : model,
        answers,
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

import type {
  DecisionProvider,
  DecisionRequest,
  DecisionResponse,
} from './types.js'

export interface ChainedDecisionProviderOptions {
  /** Providers in priority order. A failing provider falls through to the next;
   *  the last one should be infallible (e.g. the stub) so the chain never
   *  errors outright. */
  providers: DecisionProvider[]
  /** Telemetry hook: a provider failed, the chain is moving on. */
  onFallback?: (failed: { provider: string; error: string }, next: string | null) => void
}

/**
 * Decision provider chain — try providers in order, first success wins.
 *
 * The live Jev path can be blocked by account state rather than code (e.g. the
 * Vercel AI Gateway answers 403 `customer_verification_required` until a card
 * is on file). A single-provider config turns that into a hard 502 on the
 * product route and a silent no-op in the tier inferrer; a chain degrades to
 * the next live backend and finally to the stub, and every response carries a
 * `provider` field saying which member actually answered.
 */
export function createChainedDecisionProvider(
  opts: ChainedDecisionProviderOptions,
): DecisionProvider {
  const providers = opts.providers.filter((p) => Boolean(p))
  if (providers.length === 0) throw new Error('chained decision provider needs at least one provider')
  const models = [...new Set(providers.flatMap((p) => p.models ?? []))]

  return {
    id: `chain(${providers.map((p) => p.id).join(' → ')})`,
    models: models.length > 0 ? models : undefined,
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      let lastError: unknown
      for (let i = 0; i < providers.length; i++) {
        try {
          const res = await providers[i].decide(req)
          return { ...res, provider: providers[i].id }
        } catch (err) {
          lastError = err
          const error = err instanceof Error ? err.message : String(err)
          const next = providers[i + 1]?.id ?? null
          opts.onFallback?.({ provider: providers[i].id, error }, next)
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError))
    },
  }
}

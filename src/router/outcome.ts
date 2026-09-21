/**
 * Classified terminal outcome for a gateway request — the shared vocabulary
 * for billing, error-rate accounting, and retry policy (see
 * docs/billing-outcomes.md). Mirrors the Hopscotch-style taxonomy:
 * rejected pre-flight, truncated, client abort, ok, provider error.
 */
export type Outcome =
  | 'rejected_pre_flight'
  | 'truncated'
  | 'client_abort'
  | 'ok'
  | 'provider_error'

export interface OutcomeInput {
  /** Number of provider candidates the router actually attempted. */
  attempted: number
  /** Whether any token/content reached the client stream. */
  tokensEmitted: boolean
  /** The client disconnected mid-stream. */
  clientAborted?: boolean
  /** The upstream stream finished normally (done event, usage recorded). */
  completed?: boolean
}

/**
 * Classify how a request ended.
 *
 * Priority order matters: a pre-flight rejection (nothing attempted) wins
 * outright; a client abort after tokens were emitted is its own outcome
 * (billed partial, excluded from error rate); an incomplete stream after
 * tokens were emitted is truncated — mid-stream cutoffs never fail over, so
 * this is terminal; a clean completion is ok; everything else (provider was
 * attempted, nothing emitted, no completion) is provider_error.
 */
export function classifyOutcome(r: OutcomeInput): Outcome {
  if (r.attempted === 0) return 'rejected_pre_flight'
  if (r.tokensEmitted && r.clientAborted) return 'client_abort'
  if (r.tokensEmitted && !r.completed) return 'truncated'
  if (r.completed) return 'ok'
  return 'provider_error'
}

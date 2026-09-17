/**
 * Typed-decision inference — System One models (e.g. TypeSafe AI's Jev).
 *
 * Unlike an LLM (text in → text out), a decision model takes unstructured
 * *state* plus typed *questions* and returns typed, probabilistic answers that
 * software can branch on directly — no parsing, no hallucinated shape. This
 * module is provider-agnostic: the gateway and routing features depend only on
 * the `DecisionProvider` interface, so any decision backend can slot in.
 */

/** Choice question: pick one option from a named map of criteria. */
export interface ChoiceQuestion {
  type: 'choice'
  /** The judgment to make about the state. */
  instructions: string
  /** Option id → description of when that option applies. */
  criteria: Record<string, string>
}

/** Score question: place the state on an ordered ladder of levels. */
export interface ScoreQuestion {
  type: 'score'
  /** The judgment to make about the state. */
  instructions: string
  /** Ordered levels, coarse → fine. The answer may land between two. */
  criteria: string[]
}

/** Noul question: the probability that a statement about the state is true. */
export interface NoulQuestion {
  type: 'noul'
  /** The statement to judge. */
  instructions: string
  /** Optional clarification of what yes and no mean. */
  criteria?: string
}

export type DecisionQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion

/** One request: a state plus every question that should be judged against it. */
export interface DecisionRequest {
  /** The unstructured input the questions are evaluated against (any JSON). */
  state: unknown
  /** Questions by caller-chosen id; each is answered independently, in parallel. */
  questions: Record<string, DecisionQuestion>
  /** Backend model override; providers apply their own default when omitted. */
  model?: string
}

export interface ChoiceAnswer {
  type: 'choice'
  /** The selected option id. */
  choice: string
  /** Distribution across every option id. */
  probabilities: Record<string, number>
  /** How peaked the distribution is (0–1). */
  confidence: number
}

export interface ScoreAnswer {
  type: 'score'
  /** Position along the criteria ladder (0 … criteria.length − 1, may be fractional). */
  score: number
  /** Level index → level text. */
  legend: Record<string, string>
  /** Distribution across levels. */
  probabilities: Record<string, number>
  confidence: number
}

export interface NoulAnswer {
  type: 'noul'
  /** Probability the statement is true (0–1); ~0.5 means uncertain. */
  noul: number
}

export type DecisionAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer

export interface DecisionUsage {
  inputTokens: number
  outputTokens: number
}

export interface DecisionResponse {
  model: string
  /** Answers under the caller-chosen ids from the request. */
  answers: Record<string, DecisionAnswer>
  usage?: DecisionUsage
}

/**
 * A decision backend. Deliberately tiny: one call, typed in and typed out.
 * Implementations are expected to be cheap, fast, and free of text generation
 * (that's the point of the model class) — so callers may invoke them in
 * latency-sensitive paths (routing) with an external timeout applied.
 */
export interface DecisionProvider {
  /** Stable label for telemetry (e.g. `typesafe`, `stub`). */
  id: string
  /** Evaluate every question against the state in one parallel call. */
  decide(req: DecisionRequest): Promise<DecisionResponse>
  /** Models this provider can serve, for advertisement (e.g. `['jev-latest']`). */
  models?: string[]
}

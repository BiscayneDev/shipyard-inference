import type {
  LLMChatParams,
  RoutingHints,
  AdSignal,
  LoopCategory,
  LoopTier,
} from '../types.js'
import { estimateInputTokens } from './estimate.js'

/**
 * The classifier: an envelope-only layer above the `Router`. From a request's
 * *structure* — tool signatures, message count, volume, requested output — it
 * derives both (a) `RoutingHints` (so callers need not hand-tune them) and (b)
 * an {@link AdSignal} (the ad-inventory targeting key). It deliberately never
 * reads message *content*: only tool **names** and coarse volume metrics, which
 * are the developer's declared capabilities, not the end user's data.
 *
 * It is a pure, dependency-free function — no model call, no network — so it is
 * free to run synchronously in the hot path on every request.
 */

/**
 * Tool-name keyword tables. Each tool's `name` is lowercased and tested for any
 * of these substrings; the category with the most matching tools wins, ties
 * broken by the order below (coding → data → research → writing). Matched
 * against tool names only — never message content.
 */
const CATEGORY_KEYWORDS: Array<[Exclude<LoopCategory, 'chat'>, string[]]> = [
  [
    'coding',
    [
      'read_file', 'write_file', 'edit', 'bash', 'shell', 'run_command',
      'execute', 'str_replace', 'create_file', 'apply_patch', 'grep', 'glob',
      'git', 'lint', 'compile', 'terminal', 'view_file', 'list_files', 'code',
      'file',
    ],
  ],
  [
    'data',
    [
      'sql', 'query', 'database', 'bigquery', 'table', 'dataframe', 'pandas',
      'chart', 'plot', 'spreadsheet', 'csv', 'analyze',
    ],
  ],
  [
    'research',
    [
      'search', 'web_search', 'fetch', 'browse', 'browser', 'navigate',
      'scrape', 'crawl', 'google', 'wikipedia', 'lookup', 'retrieve', 'url',
      'open_url',
    ],
  ],
  ['writing', ['document', 'draft', 'doc', 'translate', 'summarize', 'rewrite', 'compose']],
]

/** Output budget (tokens) at/above which a no-tool request looks like generation, not chat. */
const LARGE_OUTPUT_TOKENS = 1_500
/** Tool count at/above which an unrecognized toolset still looks like an agent harness. */
const AGENTIC_TOOL_COUNT = 3
/** Volume thresholds that bump an otherwise-short loop to `long`. */
const HIGH_VOLUME_INPUT_TOKENS = 4_000
const HIGH_VOLUME_TOOL_COUNT = 5
const HIGH_VOLUME_OUTPUT_TOKENS = 2_000
/** Context/output sizes that justify a frontier-tier floor. */
const FRONTIER_INPUT_TOKENS = 32_000
const FRONTIER_OUTPUT_TOKENS = 8_000

/** Categories that are long-running agent loops regardless of per-request volume. */
const LONG_LOOP: Record<LoopCategory, boolean> = {
  coding: true,
  research: true,
  data: true,
  writing: false,
  chat: false,
}

function categorize(params: LLMChatParams): LoopCategory {
  const names = params.tools.map((t) => t.name.toLowerCase())

  // No tools → a one-shot completion. A large output budget reads as
  // generation/writing; otherwise it's conversational chat.
  if (names.length === 0) {
    return (params.maxTokens ?? 0) >= LARGE_OUTPUT_TOKENS ? 'writing' : 'chat'
  }

  let best: { cat: Exclude<LoopCategory, 'chat'>; score: number } | undefined
  for (const [cat, kws] of CATEGORY_KEYWORDS) {
    const score = names.reduce(
      (n, name) => n + (kws.some((k) => name.includes(k)) ? 1 : 0),
      0,
    )
    if (score > 0 && (!best || score > best.score)) best = { cat, score }
  }
  if (best) return best.cat

  // Tools present but unrecognized: a sizable toolset still implies an agent
  // harness (generic long loop, bucketed as coding); a tool or two looks like
  // simple function-calling chat.
  return names.length >= AGENTIC_TOOL_COUNT ? 'coding' : 'chat'
}

function isHighVolume(params: LLMChatParams): boolean {
  return (
    estimateInputTokens(params) >= HIGH_VOLUME_INPUT_TOKENS ||
    params.tools.length >= HIGH_VOLUME_TOOL_COUNT ||
    (params.maxTokens ?? 0) >= HIGH_VOLUME_OUTPUT_TOKENS
  )
}

function computeLoopTier(params: LLMChatParams, category: LoopCategory): LoopTier {
  if (LONG_LOOP[category]) return 'long'
  return isHighVolume(params) ? 'long' : 'short'
}

function deriveHints(params: LLMChatParams, tier: LoopTier): RoutingHints {
  const inputTok = estimateInputTokens(params)
  const outputBudget = params.maxTokens ?? 4096
  const hints: RoutingHints = {
    // Reserve room for the estimated prompt + output. Matches the router's own
    // context-fit guard, so it never excludes a model the guard wouldn't.
    minContextWindow: inputTok + outputBudget,
  }
  // Quality floor: very large contexts justify a frontier model; other long
  // loops deserve at least a standard model. Short/chat loops stay
  // unconstrained so the cost-optimizer can pick the cheapest capable model.
  if (inputTok >= FRONTIER_INPUT_TOKENS || outputBudget >= FRONTIER_OUTPUT_TOKENS) {
    hints.tier = 'frontier'
  } else if (tier === 'long') {
    hints.tier = 'standard'
  }
  return hints
}

/** Classify a request into derived routing hints + an ad-inventory signal. */
export function classify(params: LLMChatParams): { hints: RoutingHints; ad: AdSignal } {
  const loopCategory = categorize(params)
  const loopTier = computeLoopTier(params, loopCategory)
  return { hints: deriveHints(params, loopTier), ad: { loopCategory, loopTier } }
}

/**
 * Merge classifier-derived hints under any the caller already supplied — the
 * caller always wins per field, so explicit `routingHints` are never overridden.
 */
export function mergeRoutingHints(
  caller: RoutingHints | undefined,
  derived: RoutingHints,
): RoutingHints {
  return { ...derived, ...caller }
}

import type { LLMStreamEvent } from '../types.js'
import { TENDER_DEFAULTS } from './types.js'

/**
 * Hooks fired across a request's wait lifecycle. The observer NEVER receives the
 * content stream writer — it can only signal these callbacks, so a placement can
 * never be spliced into the response (the placement invariant, by construction).
 */
export interface WaitObserverHooks {
  /** A qualifying wait window opened (idle exceeded `minWaitMs` with no token). */
  onWaitWindow(): void | Promise<void>
  /** The wait ended: first content token arrived after the window opened. */
  onFirstToken?(measuredWaitMs: number): void
  /** The stream finished (whether or not a window ever opened). */
  onSettled?(totalMs: number): void
}

export interface WaitObserverOptions {
  /** Minimum idle before a window qualifies (default `MIN_WAIT_MS`). */
  minWaitMs?: number
}

/**
 * Wrap a model stream and observe its wait window. Pass-through generator: it
 * yields every event unchanged (so the caller still drives the real content
 * stream), while measuring time-to-first-token out of band.
 *
 * Semantics (section 5 of the spec):
 *  - If the first content event arrives within `minWaitMs`, the flash is
 *    sub-perceptual: no window, no bill.
 *  - If `minWaitMs` elapses with no content yet, the window opens NOW (so a
 *    placement can render DURING the idle, not after) and `onFirstToken` later
 *    reports the real measured wait when the token finally lands.
 *
 * Inter-step gaps in an agentic run surface naturally: each step is its own
 * `chatStream`, so wrapping each one measures each gap with this same code.
 */
export async function* observeWaitWindow(
  stream: AsyncIterable<LLMStreamEvent>,
  hooks: WaitObserverHooks,
  options: WaitObserverOptions = {},
): AsyncIterable<LLMStreamEvent> {
  const minWaitMs = options.minWaitMs ?? TENDER_DEFAULTS.MIN_WAIT_MS
  const startedAt = Date.now()
  let firstContentSeen = false
  let windowOpened = false

  const timer = setTimeout(() => {
    windowOpened = true
    void hooks.onWaitWindow()
  }, minWaitMs)

  try {
    for await (const event of stream) {
      if (!firstContentSeen && event.type !== 'done') {
        firstContentSeen = true
        clearTimeout(timer)
        if (windowOpened) hooks.onFirstToken?.(Date.now() - startedAt)
      }
      yield event
    }
  } finally {
    clearTimeout(timer)
    hooks.onSettled?.(Date.now() - startedAt)
  }
}

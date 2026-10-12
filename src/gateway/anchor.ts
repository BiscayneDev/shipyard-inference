/**
 * Conversation anchor — model continuity keyed on the API key.
 *
 * Survive's session-side guarantee: when an agent (identified by its API key,
 * `account.userId`) makes `auto` requests, the gateway remembers which
 * candidate/model/tier it was routed to and injects that as a SOFT preference
 * on the next request. So a multi-turn conversation stays on the same model
 * (no silent drift mid-session), and a drained-and-refilled agent resumes on
 * the same model after a top-up. Identity is the API key because Hermes and
 * Claude Code cannot send custom headers — the bearer key IS the anchor.
 *
 * Honest scope (per spec): model continuity + top-up resume only. It does NOT
 * resurrect crashed agents — clients resend their own history. An anchor is a
 * preference, never a hard pin: it only applies when the anchored candidate is
 * still in the configured pool, so a stale/removed preference degrades to
 * normal routing and can never take an app down.
 */
import type { RoutingHints } from '../types.js'

/** What a successful route recorded about an account's last request. */
export interface ConversationAnchor {
  /** Candidate id that served the last request (or `provider` id). */
  provider: string
  /** Model id that served it (optional — some providers default the model). */
  model?: string
  /** Resolved tier, when routed (economy/standard/frontier). */
  tier?: 'economy' | 'standard' | 'frontier'
  /** Epoch ms of the last routed request. */
  lastAt: number
}

/** Durable store for anchors. Memory is the reference impl; the interface is
 *  the seam for a SQLite/Supabase-backed store (appliance persistence). */
export interface ConversationAnchorStore {
  get(accountId: string): Promise<ConversationAnchor | undefined>
  set(accountId: string, anchor: ConversationAnchor): Promise<void>
  clear(accountId: string): Promise<void>
}

/** Default TTL: an anchor older than this no longer applies. */
export const ANCHOR_TTL_MS = 24 * 60 * 60 * 1000

/** In-memory anchor store — the appliance default (no persistence). */
export class MemoryConversationAnchorStore implements ConversationAnchorStore {
  private map = new Map<string, ConversationAnchor>()

  async get(accountId: string): Promise<ConversationAnchor | undefined> {
    const a = this.map.get(accountId)
    if (!a) return undefined
    if (Date.now() - a.lastAt > ANCHOR_TTL_MS) {
      this.map.delete(accountId)
      return undefined
    }
    return a
  }
  async set(accountId: string, anchor: ConversationAnchor): Promise<void> {
    this.map.set(accountId, anchor)
  }
  async clear(accountId: string): Promise<void> {
    this.map.delete(accountId)
  }
}

/**
 * Keep an anchor fresh and truthful: store a live route's provider/model/tier.
 * Never clobbers lastAt backwards; a `lastAt: undefined` means "now".
 */
export function anchorFromRoute(
  route: { provider?: string; model?: string; tier?: ConversationAnchor['tier'] },
  lastAt = Date.now(),
): ConversationAnchor | undefined {
  if (!route.provider) return undefined
  return {
    provider: route.provider,
    ...(route.model ? { model: route.model } : {}),
    ...(route.tier ? { tier: route.tier } : {}),
    lastAt,
  }
}

/**
 * Turn a stored anchor into a routing hint — ONLY when the preferred candidate
 * is still configured (so a stale preference never pins to a removed provider).
 * Returns undefined when the anchor shouldn't apply (missing/out of pool).
 */
export function anchorToHints(
  anchor: ConversationAnchor | undefined,
  configuredCandidateIds: string[],
): RoutingHints | undefined {
  if (!anchor) return undefined
  // The anchored provider may have been removed, renamed, or proxied — if it's
  // no longer in the pool, let normal routing decide (soft preference).
  if (configuredCandidateIds.includes(anchor.provider)) {
    return {
      prefer: {
        provider: anchor.provider,
        ...(anchor.model ? { model: anchor.model } : {}),
      },
    }
  }
  return { prefer: { provider: anchor.provider } }
}

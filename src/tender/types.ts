// Tender — the idle-attention monetization layer for the shipyard-inference
// gateway. It sells the *wait state* of an inference request as a sponsored
// placement, settles it in USDC, and credits the revenue back against the
// requester's own inference bill.
//
// ── The placement invariant (non-negotiable) ──────────────────────────────
// A `Placement` is NEVER injected into the prompt, the model context, or the
// response stream content. It is delivered on a side channel (`PlacementSurface`)
// and painted by the surface in its own UI chrome, structurally OUTSIDE the
// context window. This is enforced by construction: a `Placement` is a distinct
// type that only ever flows through `PlacementSurface.render`, and the wait
// observer that triggers it has no handle on the content stream — so it cannot
// splice. Do not give it one.

/** Config defaults (section 11 of the build spec). Override per-deployment. */
export const TENDER_DEFAULTS = {
  /** Don't bill sub-perceptual flashes — a wait must exceed this to qualify. */
  MIN_WAIT_MS: 800,
  /** A bid block buys this many impressions. */
  IMPRESSIONS_PER_BLOCK: 1000,
  /** Minimum bid, in USDC, per block. */
  MIN_BID_USDC: 1,
  /** A "click" (agent calls the sponsored endpoint) bills at this × impression. */
  CLICK_MULTIPLIER: 50,
  /** Fraction of the impression price that accrues to the request's wallet. */
  REQUESTER_SHARE: 0.5,
  /** Batch sweep cadence, not per-impression on-chain. */
  SETTLEMENT: 'paybox-mpp-session',
  CHAIN: 'solana',
  ASSET: 'USDC',
} as const

/** Derived per-impression price floor: a block's min bid spread over its impressions. */
export const impressionFloorUsdc = (
  cfg: { MIN_BID_USDC: number; IMPRESSIONS_PER_BLOCK: number } = TENDER_DEFAULTS,
): number => cfg.MIN_BID_USDC / cfg.IMPRESSIONS_PER_BLOCK

/** Coarse model tier used for cheap relevance matching (no PII). */
export type ModelClass = 'frontier' | 'mid' | 'small'

/**
 * The request context a wait window is auctioned against, and the attribution
 * target for settlement. Targeting reads ONLY from this — request context, never
 * user PII or behavioral history.
 */
export interface TenderRequestContext {
  /** Gateway-issued unique id for the in-flight request. */
  requestId: string
  /** Which surface is rendering this request. */
  surfaceId: string
  model?: string
  provider?: string
  /** Coarse capability tier of the routed model. */
  modelClass?: ModelClass
  /** True when this is an agentic / tool-use request (the fat inventory). */
  agentic?: boolean
  /** Coarse task label (e.g. "code", "chat", "analysis"). */
  taskType?: string
  /** Marketplace category this request relates to, if any. */
  marketplaceCategory?: string
  /** Wallet that caused the wait — the revenue-share target. */
  userWallet?: string
  /** Opaque end-user id (`metadata.userId`). */
  userId?: string
}

/** What an advertiser is targeting. Empty/undefined fields match anything. */
export interface TargetingSpec {
  modelClasses?: ModelClass[]
  taskTypes?: string[]
  /** Restrict to agentic (true) or non-agentic (false) requests. */
  agentic?: boolean
  marketplaceCategories?: string[]
}

/** A live bid for placement slots, drawn from a funded campaign. */
export interface Bid {
  placementId: string
  advertiserWallet: string
  /** The marketplace x402 listing being promoted; "click" = the agent calls it. */
  endpointUrl: string
  /** Price per impression, in USDC. Must be >= the derived floor. */
  usdcPerImpression: number
  /** Impressions remaining in the funded block. */
  remainingImpressions: number
  /** The sponsored status line this campaign renders (<= 80 chars). */
  line: string
  targeting: TargetingSpec
}

/** A seeded advertiser campaign (config-first; no self-serve dashboard in v1). */
export interface Campaign extends Bid {
  campaignId: string
  /** USDC funded into the campaign, held against placements. */
  fundedUsdc: number
}

/**
 * A won placement, handed to a surface for chrome-only rendering. It carries no
 * field that could flow into message content — see the placement invariant.
 */
export interface Placement {
  placementId: string
  requestId: string
  /** The sponsored status line text (<= 80 chars). */
  line: string
  /** Callable marketplace endpoint; an agent invoking it IS the "click". */
  endpointUrl: string
  advertiserWallet: string
  usdcPerImpression: number
}

/**
 * The entire surface contract. A new render target (portal IDE, Dock, the VS Code
 * extension) implements ONLY this. Surfaces render in their own chrome, on a side
 * channel, structurally outside the model context window.
 */
export interface PlacementSurface {
  /** Stable id, e.g. "portal-ide" | "dock" | "vscode-ext". */
  readonly id: string
  render(placement: Placement, ctx: TenderRequestContext): Promise<void>
  clear(requestId: string): Promise<void>
}

/**
 * The gateway's signed claim that a real, billed inference request produced an
 * impression. This is the unit settlement releases against (the moat).
 */
export interface UsageAttestation {
  requestId: string
  model: string
  /** MUST be > 0 — a real provider response was paid for. */
  billedCostUsd: number
  /** MUST be >= MIN_WAIT_MS — a real, perceptible wait occurred. */
  measuredWaitMs: number
  /** Which PlacementSurface rendered. */
  surfaceId: string
  /** Attribution target for the revenue share. */
  userWallet: string
  placementId: string
  issuedAt: number
  /** Gateway key signature over a canonical digest of the above (hex). */
  sig: string
}

/** Outcome of settling one placement against its attestation. */
export interface SettlementResult {
  placementId: string
  requestId: string
  /** Impression price charged to the advertiser, in USDC. */
  grossUsdc: number
  /** Share accrued to the requester's wallet, in USDC. */
  requesterShareUsdc: number
  userWallet: string
  /** Whether the amounts were accrued (await sweep) vs swept on-chain now. */
  status: 'accrued' | 'swept' | 'rejected'
  reason?: string
}

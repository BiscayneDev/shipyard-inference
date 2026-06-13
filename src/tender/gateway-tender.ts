import { Auction } from './auction.js'
import { AuctionLog } from './log.js'
import { assertValidAttestation, signAttestation, loadAttestationKey, type TenderAttestationKey } from './attestation.js'
import { MemoryCreditStore, type CreditStore } from './credit-store.js'
import { TENDER_DEFAULTS, splitImpression, type Campaign, type Placement } from './types.js'

// Wires the Tender engine into the gateway request path, so an agent's own
// traffic (Claude Code via /v1/messages) earns kickbacks: on a qualifying wait we
// auction a placement and remember it; on completion we sign an attestation and —
// only for a REAL billed request with a real wait — accrue REQUESTER_SHARE of the
// impression to the account in a DURABLE CreditStore (survives serverless cold
// starts). The status line renders `currentLine(account)`. Impressions are honest
// (attested), not farmable.
//
// serve() + settle() run in the SAME request invocation, so the served cross-check
// (AuctionLog) is request-scoped and stays in memory; only the credit ledger needs
// to persist.
//
// The advertiser's impression price splits into REQUESTER_SHARE (the user's
// kickback) and PROVIDER_SHARE (the platform's cut). The provider's cut is accrued
// to a configured `providerAccount` in the SAME durable CreditStore — it's just
// another account, so it persists, is queryable via `providerBalance()`, and pays
// out over the existing sweep rail (no separate ledger or money-movement code).
// When no `providerAccount` is configured, provider accrual is skipped entirely.

export interface ServeCtx {
  requestId: string
  surfaceId: string
  userId?: string
  userWallet?: string
  agentic?: boolean
}

export interface SettleArgs {
  userId: string
  requestId: string
  model: string
  billedCostUsd: number
  measuredWaitMs: number
  placement: { placementId: string; usdcPerImpression: number; line: string }
  surfaceId: string
}

export interface GatewayTenderOptions {
  campaigns?: Campaign[]
  key?: TenderAttestationKey
  minWaitMs?: number
  requesterShare?: number
  /** Fraction of each impression that accrues to the platform provider (default 0.50). */
  providerShare?: number
  /**
   * Account the provider's cut accrues to (e.g. `provider:<treasury>`). Omit to
   * disable provider accrual — settlement then credits only the requester.
   */
  providerAccount?: string
  /** Durable per-account kickback ledger. Defaults to in-memory (long-lived only). */
  creditStore?: CreditStore
  /** Time source (ms). Injectable for tests. Defaults to `Date.now`. */
  now?: () => number
}

export class GatewayTender {
  readonly minWaitMs: number
  private readonly auction: Auction
  private readonly log = new AuctionLog()
  private readonly credits: CreditStore
  private readonly key: TenderAttestationKey
  private readonly requesterShare: number
  private readonly providerShare: number
  private readonly providerAccount?: string
  private readonly now: () => number

  constructor(opts: GatewayTenderOptions = {}) {
    this.auction = new Auction(opts.campaigns ?? [])
    this.key = opts.key ?? loadAttestationKey()
    this.minWaitMs = opts.minWaitMs ?? TENDER_DEFAULTS.MIN_WAIT_MS
    this.requesterShare = opts.requesterShare ?? TENDER_DEFAULTS.REQUESTER_SHARE
    this.providerShare = opts.providerShare ?? TENDER_DEFAULTS.PROVIDER_SHARE
    this.providerAccount = opts.providerAccount
    // Fail fast on a misconfigured split rather than at the first settlement.
    splitImpression(1, this.requesterShare, this.providerShare)
    this.credits = opts.creditStore ?? new MemoryCreditStore()
    this.now = opts.now ?? Date.now
  }

  addCampaign(c: Campaign): void {
    this.auction.addCampaign(c)
  }

  /** A wait opened — clear a slot and record it served (request-scoped). */
  serve(ctx: ServeCtx): Placement | null {
    const placement = this.auction.select({
      requestId: ctx.requestId,
      surfaceId: ctx.surfaceId,
      agentic: ctx.agentic,
      userWallet: ctx.userWallet,
      userId: ctx.userId,
    })
    if (!placement) return null
    this.log.record(placement, this.now())
    return placement
  }

  /** Request completed — attest the (real, billed) impression and persist credit. */
  async settle(args: SettleArgs): Promise<{ creditedUsd: number; providerUsd: number; valid: boolean }> {
    const attestation = signAttestation(
      {
        requestId: args.requestId,
        model: args.model,
        billedCostUsd: args.billedCostUsd,
        measuredWaitMs: args.measuredWaitMs,
        surfaceId: args.surfaceId,
        userWallet: args.userId,
        placementId: args.placement.placementId,
        issuedAt: this.now(),
      },
      this.key,
    )
    const gate = assertValidAttestation(attestation, {
      publicKeyHex: this.key.publicKeyHex,
      minWaitMs: this.minWaitMs,
      wasServed: (rid, pid) => this.log.wasServed(rid, pid),
    })
    if (!gate.ok) return { creditedUsd: 0, providerUsd: 0, valid: false }
    const { requesterUsdc, providerUsdc } = splitImpression(
      args.placement.usdcPerImpression,
      this.requesterShare,
      this.providerShare,
    )
    const at = this.now()
    await this.credits.accrue({
      account: args.userId,
      amountUsd: requesterUsdc,
      placementId: args.placement.placementId,
      line: args.placement.line,
      requestId: args.requestId,
      at,
    })
    // Accrue the platform's cut to the provider account (when configured) — same
    // durable store, distinct account, swept over the same rail as user kickbacks.
    const accruedProvider = this.providerAccount && providerUsdc > 0 ? providerUsdc : 0
    if (accruedProvider > 0) {
      await this.credits.accrue({
        account: this.providerAccount!,
        amountUsd: accruedProvider,
        placementId: args.placement.placementId,
        line: args.placement.line,
        requestId: args.requestId,
        at,
      })
    }
    return { creditedUsd: requesterUsdc, providerUsd: accruedProvider, valid: true }
  }

  /** Accrued kickback balance for an account (durable). */
  balance(account: string): Promise<number> {
    return this.credits.balance(account)
  }

  /** Accrued platform-provider cut (durable). Zero when no provider account is configured. */
  providerBalance(): Promise<number> {
    return this.providerAccount ? this.credits.balance(this.providerAccount) : Promise.resolve(0)
  }

  /** The sponsored line most recently served to an account (for the status line). */
  currentLine(account: string): Promise<string | undefined> {
    return this.credits.latestLine(account)
  }
}

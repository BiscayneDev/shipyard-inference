import { Auction } from './auction.js'
import { AuctionLog } from './log.js'
import { CreditLedger } from './ledger.js'
import { accrueSettlement } from './settle.js'
import { signAttestation, loadAttestationKey, type TenderAttestationKey } from './attestation.js'
import { TENDER_DEFAULTS, type Campaign, type Placement } from './types.js'

// Wires the Tender engine into the gateway request path, so an agent's own
// traffic (e.g. Claude Code via /v1/messages) earns kickbacks: on a qualifying
// wait we auction a placement and remember it as the account's "current" ad; on
// completion we sign an attestation and accrue REQUESTER_SHARE of the impression
// to the account — only for a REAL billed request with a real wait. The status
// line renders `current(account)`. Impressions are honest (attested), not farmed.

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
  placement: { placementId: string; usdcPerImpression: number }
  surfaceId: string
}

export interface GatewayTenderOptions {
  campaigns?: Campaign[]
  key?: TenderAttestationKey
  minWaitMs?: number
  requesterShare?: number
  /** Time source (ms). Injectable for tests. Defaults to `Date.now`. */
  now?: () => number
}

export class GatewayTender {
  readonly minWaitMs: number
  private readonly auction: Auction
  private readonly log = new AuctionLog()
  private readonly ledger = new CreditLedger()
  private readonly key: TenderAttestationKey
  private readonly requesterShare: number
  private readonly now: () => number
  private readonly current = new Map<string, Placement>()

  constructor(opts: GatewayTenderOptions = {}) {
    this.auction = new Auction(opts.campaigns ?? [])
    this.key = opts.key ?? loadAttestationKey()
    this.minWaitMs = opts.minWaitMs ?? TENDER_DEFAULTS.MIN_WAIT_MS
    this.requesterShare = opts.requesterShare ?? TENDER_DEFAULTS.REQUESTER_SHARE
    this.now = opts.now ?? Date.now
  }

  addCampaign(c: Campaign): void {
    this.auction.addCampaign(c)
  }

  /** A wait opened — clear a slot and remember it as this account's current ad. */
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
    if (ctx.userId) this.current.set(ctx.userId, placement)
    return placement
  }

  /** Request completed — attest the (real, billed) impression and accrue credit. */
  settle(args: SettleArgs): { creditedUsd: number; valid: boolean } {
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
    const r = accrueSettlement(attestation, {
      publicKeyHex: this.key.publicKeyHex,
      ledger: this.ledger,
      pricePerImpressionUsdc: args.placement.usdcPerImpression,
      requesterShare: this.requesterShare,
      minWaitMs: this.minWaitMs,
      wasServed: (rid, pid) => this.log.wasServed(rid, pid),
      at: this.now(),
    })
    return { creditedUsd: r.requesterShareUsdc, valid: r.status === 'accrued' }
  }

  /** Accrued kickback balance for an account. */
  balance(account: string): number {
    return this.ledger.balance(account)
  }

  /** The sponsored line currently served to an account (for the status line). */
  currentLine(account: string): string | undefined {
    return this.current.get(account)?.line
  }
}

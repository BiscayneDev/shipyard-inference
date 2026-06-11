import type {
  Campaign,
  Placement,
  TargetingSpec,
  TenderRequestContext,
} from './types.js'
import { impressionFloorUsdc, TENDER_DEFAULTS } from './types.js'

/**
 * Cheap relevance, not an ad network. A campaign matches when every constraint it
 * declares is satisfied by the request context; an unspecified constraint matches
 * anything. Targeting reads ONLY request context — no user PII (section 6).
 */
export function matchesTargeting(t: TargetingSpec, ctx: TenderRequestContext): boolean {
  if (t.agentic !== undefined && t.agentic !== Boolean(ctx.agentic)) return false
  if (t.modelClasses?.length && ctx.modelClass && !t.modelClasses.includes(ctx.modelClass)) {
    return false
  }
  if (t.taskTypes?.length && ctx.taskType && !t.taskTypes.includes(ctx.taskType)) return false
  if (
    t.marketplaceCategories?.length &&
    ctx.marketplaceCategory &&
    !t.marketplaceCategories.includes(ctx.marketplaceCategory)
  ) {
    return false
  }
  return true
}

export interface AuctionOptions {
  minBidUsdc?: number
  impressionsPerBlock?: number
}

/**
 * In-memory, off-chain first-price auction. Keep v1 dumb and fast: highest live
 * bid among matching, funded campaigns serves first; an advertiser outbids to
 * take slot #1, lower bids queue behind. Money settles via Paybox elsewhere —
 * this only clears the slot.
 */
export class Auction {
  private readonly campaigns = new Map<string, Campaign>()
  private readonly floorUsdc: number

  constructor(seed: Campaign[] = [], options: AuctionOptions = {}) {
    this.floorUsdc = impressionFloorUsdc({
      MIN_BID_USDC: options.minBidUsdc ?? TENDER_DEFAULTS.MIN_BID_USDC,
      IMPRESSIONS_PER_BLOCK: options.impressionsPerBlock ?? TENDER_DEFAULTS.IMPRESSIONS_PER_BLOCK,
    })
    for (const c of seed) this.addCampaign(c)
  }

  addCampaign(c: Campaign): void {
    this.campaigns.set(c.campaignId, { ...c })
  }

  /** Live campaigns, for inspection / a future operator view. */
  list(): Campaign[] {
    return [...this.campaigns.values()]
  }

  /**
   * Clear one slot for `ctx`. Returns the winning placement (decrementing its
   * remaining impressions) or `null` when no funded, matching bid clears the
   * floor. Selection is first-price: highest `usdcPerImpression` wins.
   */
  select(ctx: TenderRequestContext): Placement | null {
    let winner: Campaign | undefined
    for (const c of this.campaigns.values()) {
      if (c.remainingImpressions <= 0) continue
      if (c.usdcPerImpression < this.floorUsdc) continue
      if (!matchesTargeting(c.targeting, ctx)) continue
      if (!winner || c.usdcPerImpression > winner.usdcPerImpression) winner = c
    }
    if (!winner) return null

    winner.remainingImpressions -= 1
    return {
      placementId: winner.placementId,
      requestId: ctx.requestId,
      line: winner.line,
      endpointUrl: winner.endpointUrl,
      advertiserWallet: winner.advertiserWallet,
      usdcPerImpression: winner.usdcPerImpression,
    }
  }
}

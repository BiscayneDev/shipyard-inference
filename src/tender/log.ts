import type { Placement } from './types.js'

/** One served-placement record — the auction log (section 9). */
export interface ServedRecord {
  requestId: string
  placementId: string
  usdcPerImpression: number
  advertiserWallet: string
  /** The callable marketplace endpoint — invoking it is the "click". */
  endpointUrl: string
  /** When it was served (unix ms). */
  at: number
}

/**
 * In-memory auction log: what placement was served for each request, at what
 * price. The attestation release gate cross-checks against this so a settlement
 * can't release for a placement that was never actually served (section 9).
 */
export class AuctionLog {
  private readonly byRequest = new Map<string, ServedRecord>()

  record(placement: Placement, at: number): ServedRecord {
    const rec: ServedRecord = {
      requestId: placement.requestId,
      placementId: placement.placementId,
      usdcPerImpression: placement.usdcPerImpression,
      advertiserWallet: placement.advertiserWallet,
      endpointUrl: placement.endpointUrl,
      at,
    }
    this.byRequest.set(placement.requestId, rec)
    return rec
  }

  get(requestId: string): ServedRecord | undefined {
    return this.byRequest.get(requestId)
  }

  /** Did `placementId` serve for `requestId`? The gate's cross-check. */
  wasServed(requestId: string, placementId: string): boolean {
    return this.byRequest.get(requestId)?.placementId === placementId
  }

  get size(): number {
    return this.byRequest.size
  }
}

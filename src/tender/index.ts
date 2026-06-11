// Tender — idle-attention monetization for shipyard-inference.
// Render-target-agnostic: the placement logic lives here, surfaces are thin
// adapters over the same hook. See ./types.ts for the placement invariant.
export * from './types.js'
export { observeWaitWindow } from './wait.js'
export type { WaitObserverHooks, WaitObserverOptions } from './wait.js'
export { Auction, matchesTargeting } from './auction.js'
export type { AuctionOptions } from './auction.js'

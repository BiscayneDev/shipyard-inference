// Tender — idle-attention monetization for shipyard-inference.
// Render-target-agnostic: the placement logic lives here, surfaces are thin
// adapters over the same hook. See ./types.ts for the placement invariant.
export * from './types.js'
export { observeWaitWindow } from './wait.js'
export type { WaitObserverHooks, WaitObserverOptions } from './wait.js'
export { GatewayTender } from './gateway-tender.js'
export type { GatewayTenderOptions, ServeCtx, SettleArgs } from './gateway-tender.js'
export { MemoryCreditStore, SupabaseCreditStore, SUPABASE_TENDER_CREDITS_SCHEMA } from './credit-store.js'
export type { CreditStore, CreditRecord, SupabaseCreditStoreOptions } from './credit-store.js'
export { Auction, matchesTargeting } from './auction.js'
export type { AuctionOptions } from './auction.js'
export { AuctionLog } from './log.js'
export type { ServedRecord } from './log.js'
export {
  buildCampaign,
  MemoryCampaignStore,
  SupabaseCampaignStore,
  SUPABASE_CAMPAIGNS_SCHEMA,
} from './campaign-store.js'
export type {
  CampaignStore,
  CampaignInput,
  SupabaseCampaignStoreOptions,
} from './campaign-store.js'
export {
  tenderDepositConfig,
  newPaymentReference,
  buildDepositIntent,
  verifyDeposit,
} from './deposit.js'
export type { DepositConfig, DepositIntent, DepositStatus } from './deposit.js'
export {
  loadAttestationKey,
  generateAttestationSeedHex,
  attestationDigest,
  signAttestation,
  verifyAttestation,
  assertValidAttestation,
} from './attestation.js'
export type {
  TenderAttestationKey,
  AttestationGateOptions,
  GateResult,
} from './attestation.js'
export { CreditLedger } from './ledger.js'
export type { CreditEntry } from './ledger.js'
export { accrueSettlement, accrueClick, sweepCredits, usdcToAtomic } from './settle.js'
export type { AccrueOptions, ClickOptions, SweepDeps, SweepResult } from './settle.js'

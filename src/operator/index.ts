// Operator command center — central telemetry hub + drop-in reporter.
export { TelemetryHub } from './hub.js'
export type { TelemetryHubOptions } from './hub.js'
export {
  buildSavingsSnapshot,
  buildSlaSummary,
} from './hub.js'
export type {
  SavingsSnapshotInput,
  SlaSummaryInput,
} from './hub.js'

export {
  createTelemetryReporter,
  createInProcessReporter,
} from './reporter.js'
export type {
  TelemetryReporter,
  TelemetryReporterOptions,
  SettlementReport,
} from './reporter.js'

export { createOperatorConsole, parseWindowMs } from './server.js'
export type { OperatorConsoleOptions } from './server.js'

export {
  JsonlTelemetryStore,
  JsonlControlPlaneStore,
  NullTelemetryStore,
} from './store.js'
export type { TelemetryStore, ControlPlaneStore } from './store.js'

export {
  SupabaseTelemetryStore,
  SUPABASE_TELEMETRY_SCHEMA,
} from './supabase-store.js'
export type { SupabaseTelemetryStoreOptions } from './supabase-store.js'

export { readTreasuryBalance, readTreasuryBalances } from './treasury.js'
export type { TreasuryConfig } from './treasury.js'

export type {
  TelemetryEvent,
  StoredEvent,
  IngestPayload,
  RequestEvent,
  RouteSelectedEvent,
  FailoverEvent,
  RetryEvent,
  ErrorEvent,
  CacheEvent,
  SettlementEvent,
  SettlementStatus,
  TelemetryKind,
  Overview,
  TimeseriesBucket,
  BreakdownRow,
  ErrorRow,
  FeedRow,
  BillingView,
  TreasuryBalance,
  SettlementRow,
  Tenant,
  Project,
  ApiKey,
  UsageRecord,
  SavingsSnapshot,
  BillingPlan,
  SlaSummary,
  ControlPlaneKind,
  ControlPlaneRecord,
  ControlPlaneQuery,
  BillingSummary,
  RoutingHealth,
  ProviderHealthRow,
} from './types.js'

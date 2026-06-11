// Operator command center — central telemetry hub + drop-in reporter.
export { TelemetryHub } from './hub.js'
export type { TelemetryHubOptions } from './hub.js'

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
  NullTelemetryStore,
} from './store.js'
export type { TelemetryStore } from './store.js'

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
  RoutingHealth,
  ProviderHealthRow,
} from './types.js'

/** A single payment challenge parsed from an HTTP 402 response. */
export interface PaymentRequirement {
  /** Payment scheme, e.g. `exact`. */
  scheme: string
  /** Settlement network, e.g. `solana-mainnet` | `solana-devnet`. */
  network: string
  /** Asset address (e.g. the USDC mint). */
  asset: string
  /** Amount in atomic base units, as a string for precision. */
  amount: string
  /** Recipient address. */
  payTo: string
  /** The resource (URL) being paid for. */
  resource: string
  /** Server-issued anti-replay nonce, when present. */
  nonce?: string
  /** Unix-ms expiry, when present. */
  expiresAt?: number
  /** The original challenge object, for adapters that need extra fields. */
  raw?: unknown
}

/** Proof of payment returned by a `PaymentProvider`, attached on retry. */
export interface PaymentResult {
  /** Value for the payment proof header (e.g. `X-PAYMENT`). */
  header: string
  /** Idempotency reference for this settlement (typically the nonce). */
  reference: string
  /** Amount settled, in atomic base units. */
  amount: string
}

/**
 * Settles payment challenges. Implementations MUST be idempotent per
 * `requirement.nonce` (or a stable hash of resource+amount+payTo when no nonce
 * is present) so a retried request never double-pays.
 */
export interface PaymentProvider {
  pay(requirement: PaymentRequirement): Promise<PaymentResult>
  /** Optional bulk/session settlement (MPP) to amortize per-call overhead. */
  openSession?(budget: string): Promise<{ header: string; close(): Promise<void> }>
}

/** Non-interactive Solana transaction signer. */
export interface SolanaSigner {
  /** Base58 public key of the payer. */
  publicKey: string
  /** Sign a serialized transaction, returning the signed serialization. */
  signTransaction(tx: Uint8Array): Promise<Uint8Array>
}

export interface SpendCap {
  /** Max atomic base units payable for a single request. */
  perRequest?: string
  /** Max cumulative atomic base units payable over this fetch instance's life. */
  perProcess?: string
}

export interface PayingFetchOptions {
  paymentProvider: PaymentProvider
  /** Max payment-and-retry cycles per request. Default 1 (never loops). */
  maxPaymentRetries?: number
  spendCap?: SpendCap
  /** Notified after each successful settlement. */
  onPayment?: (result: PaymentResult & { resource: string }) => void
  /** Override 402 parsing for servers with a non-standard challenge shape. */
  parse402?: (response: Response) => Promise<PaymentRequirement>
  /** Header used to carry payment proof on retry. Default `X-PAYMENT`. */
  paymentHeader?: string
  /** Underlying fetch. Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

/** Thrown when a payment would exceed a configured spend cap. */
export class SpendCapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpendCapError'
  }
}

/** Thrown when settlement fails or the server re-challenges after payment. */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentError'
  }
}

/** Thrown when an optional dependency (crypto / paybox) isn't installed. */
export class MissingDependencyError extends Error {
  constructor(pkg: string, feature: string) {
    super(
      `[shipyard-inference] '${pkg}' is required for ${feature}. ` +
        `Install it: npm install ${pkg}`,
    )
    this.name = 'MissingDependencyError'
  }
}

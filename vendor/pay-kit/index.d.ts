import { P as Protocol, N as Network, a as NetworkSlug } from './protocol-j0_UHGHD.js';
export { c as caip2, t as toNetwork, b as toSolanaNetwork } from './protocol-j0_UHGHD.js';
import { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { Store } from 'mppx';
export { Store } from 'mppx';
import { MessagePartialSigner, TransactionPartialSigner } from '@solana/kit';
import { IncomingMessage, ServerResponse } from 'node:http';

/**
 * One way to pay, advertised in the 402 body's `accepts[]` array. Carries
 * the cross-SDK wire invariants (`protocol`, `scheme`, CAIP-2 `network`,
 * base-unit `amount`, `payTo`) plus protocol-specific extras.
 */
type AcceptsEntry = {
    readonly [key: string]: unknown;
    /** Base-unit integer string. */
    readonly amount: string;
    /** CAIP-2 chain identifier. */
    readonly network: string;
    readonly payTo: string;
    readonly protocol: Protocol;
    readonly scheme: string;
};
/** Everything needed to render a 402: the offer list and protocol headers. */
type Challenge = {
    /** One entry per (accepted protocol, scheme) pair. */
    readonly accepts: readonly AcceptsEntry[];
    /** Protocol challenge headers (`WWW-Authenticate` for MPP, `Payment-Required` for x402). */
    readonly headers: Readonly<Record<string, string>>;
    /** The resource being paid for (request path). */
    readonly resource: string;
};

/** Fiat currencies a {@link Price} can be denominated in. */
type Currency = 'EUR' | 'GBP' | 'USD';
/** Stablecoins a {@link Price} can settle in. */
type Stablecoin = 'CASH' | 'PYUSD' | 'USDC' | 'USDG' | 'USDT';
/** All supported settlement stablecoins, in no particular order. */
declare const STABLECOINS: readonly Stablecoin[];
/**
 * A denominated amount: fiat currency, decimal amount, and an ordered list of
 * stablecoins the amount may settle in. Immutable; arithmetic is exact
 * (fixed-point, no floats).
 *
 * @example
 * ```ts
 * import { usd } from '@solana/pay-kit';
 *
 * const price = usd('0.10');
 * price.baseUnits();      // 100000n (6 decimals)
 * price.plus(usd('0.05')) // USD 0.15
 * ```
 */
declare class Price {
    #private;
    /** Canonical decimal string, e.g. `"0.10"`. */
    readonly amount: string;
    readonly currency: Currency;
    /** Ordered settlement preference. Empty means "inherit from config". */
    readonly settlements: readonly Stablecoin[];
    private constructor();
    /** Creates a EUR price. */
    static eur(amount: string, ...settlements: Stablecoin[]): Price;
    /** Creates a GBP price. */
    static gbp(amount: string, ...settlements: Stablecoin[]): Price;
    /** Creates a USD price. */
    static usd(amount: string, ...settlements: Stablecoin[]): Price;
    /** Wire-form decimal string (alias for {@link Price.amount}). */
    amountString(): string;
    /**
     * The amount in on-chain base units.
     *
     * @param decimals - Token decimals of the settlement asset (6 for all supported stablecoins).
     */
    baseUnits(decimals?: number): bigint;
    /** Compares two same-currency prices. @throws {MixedCurrenciesError} on currency mismatch. */
    isGreaterThan(other: Price): boolean;
    /** Sums two same-currency prices. @throws {MixedCurrenciesError} on currency mismatch. */
    plus(other: Price): Price;
    /** First settlement preference, if one was set explicitly. */
    primaryCoin(): Stablecoin | undefined;
    /**
     * Subtracts a same-currency price.
     *
     * @throws {MixedCurrenciesError} on currency mismatch or negative result.
     */
    minus(other: Price): Price;
    /** Copy with a different amount, same currency and settlements. */
    withAmount(amount: string): Price;
}
/** Shorthand for {@link Price.usd}. */
declare function usd(amount: string, ...settlements: Stablecoin[]): Price;
/** Shorthand for {@link Price.eur}. */
declare function eur(amount: string, ...settlements: Stablecoin[]): Price;
/** Shorthand for {@link Price.gbp}. */
declare function gbp(amount: string, ...settlements: Stablecoin[]): Price;

/**
 * How a fee interacts with the gate amount:
 * - `within` — taken out of the gate amount (the primary recipient nets less).
 * - `on_top` — added to the customer's total (the primary recipient nets the full amount).
 */
type FeeKind = 'on_top' | 'within';
/** A fee line on a gate: who receives it, how much, and how it combines with the amount. */
type Fee = {
    readonly kind: FeeKind;
    /** Optional on-chain memo attached to this fee's transfer (max 566 bytes). */
    readonly memo?: string;
    readonly price: Price;
    /** Base58 address of the fee recipient. */
    readonly recipient: string;
};

/**
 * A fee value: either a bare {@link Price}, or a price paired with an on-chain
 * `memo` describing what the transfer is for (e.g. `"platform fee"`). The memo
 * rides along on that recipient's split transfer.
 */
type FeeSpec = Price | {
    readonly memo?: string;
    readonly price: Price;
};
/** Defaults a {@link Gate} inherits from the boot config when a field is omitted. */
type GateDefaults = {
    /** Protocols accepted when the gate does not set `accept` explicitly. */
    readonly accept: readonly Protocol[];
    /** Recipient used when the gate does not set `payTo` explicitly. */
    readonly payTo: string;
};
/**
 * The settlement shape of a gate:
 * - `fixed` — charge a fixed amount up front (MPP `charge` / x402 `exact`),
 * - `usage` — authorize a ceiling and settle the metered amount afterwards (x402 `upto`),
 * - `subscription` — activate a recurring on-chain authorization on the first call (MPP `subscription`),
 * - `session` — open a payment channel and meter streamed deliveries, settling out-of-band (MPP `session`).
 *
 * Defaults to `fixed`. `subscription` and `session` are MPP-only.
 */
type GateKind = 'fixed' | 'session' | 'subscription' | 'usage';
/** Metering config for a {@link GateKind} `session` gate (MPP `session`). */
type SessionConfig = {
    /** Idle-close delay in ms — settle the channel this long after the last delivery. */
    readonly closeDelayMs?: number;
    /** Per-delivery price in base units (the streamed unit cost). */
    readonly unitPrice: bigint;
};
/** On-chain plan binding for a {@link GateKind} `subscription` gate (MPP `subscription`). */
type SubscriptionConfig = {
    /** Number of `periodUnit`s per billing period (e.g. 30 days). */
    readonly periodCount: number;
    /** Billing period unit. The Solana profile supports `day` and `week`. */
    readonly periodUnit: 'day' | 'week';
    /** Base58 of the on-chain Plan PDA the subscription binds to. */
    readonly planId: string;
    /** Base58 of the puller pubkey that debits renewals (typically the operator). */
    readonly puller: string;
};
/** Parameters for {@link Gate.create}. */
type GateParams = {
    /** Per-gate protocol override. Omit to inherit the config default. */
    readonly accept?: readonly Protocol[];
    /** Fixed charge, or — for a `usage` gate — the authorized maximum. */
    readonly amount: Price;
    readonly description?: string;
    /** Merchant correlation id (order id, invoice number) echoed in receipts. */
    readonly externalId?: string;
    /** Fees added to the customer's total, keyed by recipient address. Each value
     * is a {@link Price}, or `{ price, memo }` to label the transfer on-chain. */
    readonly feeOnTop?: Readonly<Record<string, FeeSpec>>;
    /** Fees taken out of `amount`, keyed by recipient address. Each value is a
     * {@link Price}, or `{ price, memo }` to label the transfer on-chain. */
    readonly feeWithin?: Readonly<Record<string, FeeSpec>>;
    /** `fixed` (default), `usage`, `subscription`, or `session`. */
    readonly kind?: GateKind;
    readonly name: string;
    /** Recipient of the base amount. Omit to inherit the operator recipient. */
    readonly payTo?: string;
    /** Metering config — required for (and only valid on) `session` gates. */
    readonly session?: SessionConfig;
    /** Plan binding — required for (and only valid on) `subscription` gates. */
    readonly subscription?: SubscriptionConfig;
};
/**
 * A priced unit of work attached to a route. Immutable and validated at
 * construction so misconfiguration fails at boot, not per request.
 *
 * @example
 * ```ts
 * const gate = Gate.create(
 *   { amount: usd('10.00'), feeWithin: { [PLATFORM]: usd('0.30') }, name: 'marketplace' },
 *   { accept: ['mpp'], payTo: SELLER },
 * );
 * gate.total();          // USD 10.00
 * gate.payout(SELLER);   // USD 9.70
 * gate.payout(PLATFORM); // USD 0.30
 * ```
 */
declare class Gate {
    readonly accept: readonly Protocol[];
    readonly amount: Price;
    readonly description: string | undefined;
    readonly externalId: string | undefined;
    readonly fees: readonly Fee[];
    readonly kind: GateKind;
    readonly name: string;
    readonly payTo: string;
    /** Metering config for `session` gates; `undefined` otherwise. */
    readonly session: SessionConfig | undefined;
    /** Plan binding for `subscription` gates; `undefined` otherwise. */
    readonly subscription: SubscriptionConfig | undefined;
    private constructor();
    /**
     * Builds and validates a gate, resolving omitted fields from `defaults`.
     *
     * Validation rules (identical across the SDK family):
     * - fee currencies must match the amount currency,
     * - `feeWithin` fees must sum to less than the amount,
     * - fees with an explicit `accept` containing x402 fail
     *   ({@link ProtocolIncompatibleError}); with an inherited `accept` the
     *   gate silently narrows to MPP.
     *
     * @throws {ConfigurationError} on invalid amounts or fee sums.
     * @throws {MixedCurrenciesError} when a fee currency differs from the amount currency.
     * @throws {ProtocolIncompatibleError} when fees are combined with an explicit x402 accept.
     */
    static create(params: GateParams, defaults: GateDefaults): Gate;
    /** Whether this gate accepts the given protocol. */
    accepts(protocol: Protocol): boolean;
    /** Fees added to the customer's total. */
    feeOnTop(): readonly Fee[];
    /** Fees taken out of the amount. */
    feeWithin(): readonly Fee[];
    /** Whether any fees are configured. */
    hasFees(): boolean;
    /** What `address` nets from one settlement, or `undefined` if it receives nothing. */
    payout(address: string): Price | undefined;
    /** The customer's total: amount plus all on-top fees. */
    total(): Price;
}

/**
 * A protocol-neutral receipt for one verified, settled payment. This is what
 * route handlers receive — application code never sees which protocol
 * settled beyond the `protocol` tag.
 */
type Payment = {
    /** Name of the gate that was paid, when the gate came from a catalogue. */
    readonly gateName: string | undefined;
    /** Settling wallet address, when the protocol exposes it. */
    readonly payer: string | undefined;
    readonly protocol: Protocol;
    /** Raw credential as received (debugging, replay caches). */
    readonly raw: string | undefined;
    /** Protocol scheme that settled (`charge` for MPP, `exact` for x402). */
    readonly scheme: string;
    /** Headers to merge into the 2xx response (receipts, settlement signatures). */
    readonly settlementHeaders: Readonly<Record<string, string>>;
    /** Settlement transaction signature. */
    readonly transaction: string;
};

/**
 * The protocol seam. Both x402 and MPP are instances of one loop —
 * challenge (402) → client credential → verify → settle → receipt headers —
 * so a payment protocol is exactly one object implementing this contract.
 * Adding a protocol never changes {@link Gate}, the request verbs, or any
 * framework integration.
 */
type ProtocolAdapter = {
    /** This adapter's entry in the 402 `accepts[]` array for `gate`. */
    readonly acceptsEntry: (gate: Gate, request: Request) => Promise<AcceptsEntry>;
    /** Protocol-specific 402 headers for `gate`. */
    readonly challengeHeaders: (gate: Gate, request: Request) => Promise<Readonly<Record<string, string>>>;
    /** Whether `request` carries this protocol's payment credential. */
    readonly detect: (request: Request) => boolean;
    readonly protocol: Protocol;
    /**
     * Optional: a complete `402` response to send as-is for an unpaid request,
     * when the protocol wants to own the response body (e.g. MPP's interactive
     * HTML payment page for browsers, or its service worker). Returns
     * `undefined` to fall back to the framework's standard JSON `402`.
     */
    readonly respond?: (gate: Gate, request: Request) => Promise<Response | undefined>;
    readonly scheme: string;
    /**
     * Verifies the credential and settles the payment.
     *
     * @throws {InvalidProofError} when the credential fails verification or settlement.
     */
    readonly verifyAndSettle: (gate: Gate, request: Request) => Promise<Payment>;
};

/**
 * Any Solana Keychain signer: a kit signer that can sign both messages and
 * transactions and knows its address. All `@solana/keychain-*` backends
 * (memory, AWS KMS, GCP KMS, Vault, Privy, Turnkey, ...) satisfy this.
 */
type KeychainSigner = MessagePartialSigner & TransactionPartialSigner;
/**
 * The PayKit signer contract, shared across the SDK family:
 * `pubkey`, `sign`, `isFeePayer`, `isDemo` — plus the underlying Keychain
 * signer for handing to protocol methods.
 */
type PayKitSigner = {
    /** True only for the package-shipped demo signer. */
    readonly isDemo: boolean;
    /** Whether this signer may be used to sponsor transaction fees. */
    readonly isFeePayer: boolean;
    /** Base58 public key. */
    readonly pubkey: string;
    /** Signs an arbitrary message, returning the 64-byte Ed25519 signature. */
    readonly sign: (message: Uint8Array) => Promise<Uint8Array>;
    /** The underlying Keychain signer, accepted by protocol methods. */
    readonly signer: KeychainSigner;
};
/**
 * Static factory for PayKit signers. Local key material is handled by
 * Solana Keychain's in-memory backend (`@solana/keychain-memory`); remote
 * backends (AWS KMS, GCP KMS, Vault, Privy, Turnkey, ...) plug in through
 * {@link Signer.from}.
 *
 * @example
 * ```ts
 * const local = await Signer.file('~/.config/solana/id.json');
 *
 * import { createKeychainSigner } from '@solana/keychain';
 * const remote = Signer.from(await createKeychainSigner({ backend: 'vault', ... }));
 * ```
 */
declare const Signer: {
    /** From a base58-encoded 64-byte secret (Phantom/Solflare export). */
    base58(secret: string): Promise<PayKitSigner>;
    /** From raw secret bytes: 64-byte Solana CLI keypair or 32-byte Ed25519 seed. */
    bytes(secret: Uint8Array | readonly number[]): Promise<PayKitSigner>;
    /**
     * The package-shipped demo keypair, cached per process. Warns once;
     * refused on mainnet at configure time.
     */
    demo(): Promise<PayKitSigner>;
    /**
     * From an environment variable, auto-detecting JSON-array, hex, or base58
     * encoding. Returns `undefined` when the variable is unset or empty.
     */
    env(name: string): Promise<PayKitSigner | undefined>;
    /** From a Solana CLI keypair JSON file. */
    file(path: string): Promise<PayKitSigner>;
    /**
     * Wraps an existing Keychain (or any kit) signer — the bridge to remote
     * backends such as AWS KMS, GCP KMS, Vault, Privy, and Turnkey.
     *
     * @param options.feePayer - Whether the signer may sponsor transaction
     * fees. Defaults to `true`; set `false` for remote signers that must not
     * co-sign server-built transactions.
     */
    from(signer: KeychainSigner, options?: {
        feePayer?: boolean;
    }): PayKitSigner;
    /** Fresh ephemeral keypair (tests and throwaway environments). */
    generate(): Promise<PayKitSigner>;
    /** From a 128-character hex string (64 bytes). */
    hex(secret: string): Promise<PayKitSigner>;
    /** From a Solana CLI JSON array string, e.g. `"[1,2,...,64]"`. */
    json(jsonArray: string): Promise<PayKitSigner>;
};

/** MPP protocol options. */
type MppOptions = {
    /**
     * HMAC secret binding challenges to their contents. Resolved from
     * `PAY_KIT_MPP_SECRET` or `MPP_SECRET_KEY` when omitted; auto-generated
     * (with a warning) on localnet only.
     */
    readonly challengeBindingSecret?: string;
    /** Challenge TTL in seconds. `0` means never expires (dev only). */
    readonly expiresIn?: number;
    /**
     * Serve the interactive HTML payment page (the "Continue with Solana"
     * pay.sh experience) on `402`s for browser requests (`Accept: text/html`),
     * plus its service worker. API clients (JSON) still get the JSON `402`.
     * Default `false`.
     */
    readonly html?: boolean;
    readonly realm?: string;
};
/**
 * x402 options forwarded to the vendored exact-scheme facilitator; omitted
 * fields use upstream defaults. Smart-wallet (Path 2) verification needs an
 * RPC whose `simulateTransaction` returns inner instructions.
 */
type X402Options = {
    readonly enableSmartWalletVerification?: boolean;
    /** Compute-unit ceiling on the static path. Default: unset (no limit). */
    readonly maxComputeUnits?: number;
    /**
     * Compute-unit-price ceiling on the static path. The operator is the fee
     * payer, so the payer picks a priority fee the operator pays.
     * Default: 5,000,000 microlamports.
     */
    readonly maxPriorityFeeMicroLamports?: number;
    /**
     * Signature-count ceiling; each signature costs the operator 5,000 lamports
     * of base fee. A typical payment needs two. Default: unset (no limit).
     */
    readonly maxRequiredSignatures?: number;
    readonly smartWalletAllowedPrograms?: readonly string[];
    readonly smartWalletMaxComputeUnits?: number;
    readonly smartWalletMaxPriorityFeeMicroLamports?: number;
};
/** Merchant identity: where money lands and which key signs. */
type OperatorParams = {
    /** Whether the operator signer sponsors transaction fees. */
    readonly feePayer?: boolean;
    /** Settlement address. Defaults to the signer's public key. */
    readonly recipient?: string;
    /**
     * Defaults to the demo signer (refused on mainnet). Raw kit / Keychain
     * signers are accepted and wrapped via {@link Signer.from}.
     */
    readonly signer?: KeychainSigner | PayKitSigner;
};
/** Resolved operator identity. */
type Operator = {
    readonly feePayer: boolean;
    readonly recipient: string;
    readonly signer: PayKitSigner;
};
/** Parameters for {@link configure}. */
type ConfigureParams = {
    /** Ordered protocol preference. */
    readonly accept?: readonly Protocol[];
    readonly mpp?: MppOptions;
    /** Canonical name (`solana_localnet`) or Solana slug (`localnet`). */
    readonly network?: Network | NetworkSlug;
    readonly operator?: OperatorParams;
    /** Run boot-time safety checks. */
    readonly preflight?: boolean;
    /** Replay-protection store. Use a persistent backend in production. */
    readonly replayStore?: Store.Store;
    /** Defaults to the public RPC endpoint for the network. */
    readonly rpcUrl?: string;
    /** Ordered settlement preference. */
    readonly stablecoins?: readonly Stablecoin[];
    readonly x402?: X402Options;
};
/** Resolved, immutable boot configuration. */
type PayKitConfig = {
    readonly accept: readonly Protocol[];
    readonly mpp: {
        readonly challengeBindingSecret: string;
        readonly expiresIn: number;
        readonly html: boolean;
        readonly realm: string;
    };
    readonly network: Network;
    readonly operator: Operator;
    readonly preflight: boolean;
    readonly replayStore: Store.Store | undefined;
    readonly rpcUrl: string;
    readonly stablecoins: readonly Stablecoin[];
    readonly x402: X402Options;
};
/**
 * Builds and validates the boot configuration. Everything downstream
 * (pricing, adapters, the dispatcher) derives its defaults from this object.
 *
 * @throws {DemoSignerOnMainnetError} when the demo signer is configured on mainnet.
 * @throws {ProtocolNotSupportedError} when `accept` requests a protocol this SDK does not ship.
 * @throws {ConfigurationError} on any other invalid combination.
 *
 * @example
 * ```ts
 * const config = await configure({
 *   network: 'solana_mainnet',
 *   operator: { signer: await Signer.env('OPERATOR_KEY') },
 *   rpcUrl: 'https://mainnet.helius-rpc.com/?api-key=...',
 * });
 * ```
 */
declare function configure(params?: ConfigureParams): Promise<PayKitConfig>;
/**
 * Builds the boot configuration from `PAY_KIT_`-prefixed environment
 * variables: `NETWORK`, `RPC_URL`, `ACCEPT` and `STABLECOINS`
 * (comma-separated), `OPERATOR_KEY` (any encoding {@link Signer.env}
 * accepts), `RECIPIENT`, `FEE_PAYER`, `MPP_REALM`, `MPP_SECRET`,
 * `MPP_EXPIRES_IN`, and `PREFLIGHT`.
 */
declare function configureFromEnv(prefix?: string): Promise<PayKitConfig>;

/**
 * Usage meter handed to a usage-gated handler. The handler reports the actual
 * amount consumed (token base units) via {@link Charge.charge}; the gate settles
 * that amount - never above the authorized ceiling - after the handler returns,
 * refunding the remainder. If the handler never calls `charge`, the settled
 * amount is `0`. Mirrors the Rust `Charge` extractor on `paid_upto_*` routes.
 */
declare class Charge {
    #private;
    /** The authorized maximum for this request, in base units. */
    readonly maxBaseUnits: bigint;
    constructor(maxBaseUnits: bigint);
    /** Record the actual amount consumed (base units). Values above the ceiling are clamped; negatives floor to 0. */
    charge(baseUnits: bigint | number): void;
    /** The amount to settle (base units): the clamped charge, or `0` if never set. */
    settledBaseUnits(): bigint;
}
/** A verified `upto` authorization carried from {@link X402Upto.verifyOpen} to {@link X402Upto.settle}. */
type UptoVerified = {
    readonly maxBaseUnits: bigint;
    readonly payer: string;
    readonly payload: PaymentPayload;
    readonly requirements: PaymentRequirements;
};
/** Result of settling a `upto` authorization. */
type UptoSettlement = {
    readonly amount: string;
    readonly settlementHeaders: Readonly<Record<string, string>>;
    readonly transaction: string;
};
/**
 * Usage-based (`upto`) x402 engine: the metered counterpart to the `exact`
 * adapter. The client opens a payment channel depositing the authorized ceiling;
 * the in-process `@x402/svm` upto facilitator broadcasts the open (deposit
 * settle) before the handler runs, then settles the metered amount with a
 * single voucher (claim settle), refunding the remainder.
 *
 * `upto` does not fit the protocol-uniform {@link import('../adapter.js').ProtocolAdapter}
 * contract (which settles before the handler runs), so it is exposed as a
 * dedicated engine the framework wrappers drive - exactly as Rust ships
 * `paid_upto_*` separately from the unified gate.
 */
declare class X402Upto {
    #private;
    constructor(config: PayKitConfig);
    /** Whether `request` carries an x402 payment credential. */
    detect(request: Request): boolean;
    /**
     * The 402 challenge headers for a route capped at `maxPrice`. Pass the
     * entries from {@link accepts} to reuse one server-enriched requirement
     * (one `getLatestBlockhash` round-trip) for both the header and the body.
     */
    challengeHeaders(maxPrice: Price, request: Request, accepts?: readonly PaymentRequirements[]): Promise<Readonly<Record<string, string>>>;
    /**
     * The `accepts[]` entries for the 402 JSON body — the same server-enriched
     * requirement (`extra.recentBlockhash` + `extra.recentSlot`) the header
     * carries, so body-based `upto` clients can build the channel open too.
     */
    accepts(maxPrice: Price): Promise<readonly PaymentRequirements[]>;
    /**
     * Verify the authorization and broadcast the channel open (escrowing the
     * ceiling before the resource is served).
     *
     * In `@x402/svm` >= 2.23 the facilitator's `verify()` is a read-only
     * preflight — the open broadcast moved to `settle()`'s deposit path
     * (no `voucherSignature`, `requirements.amount === payload.maxAmount`).
     * `settle()` runs the same authorization checks `verify()` does before
     * touching the network, so calling it directly here does not skip any
     * validation — it is the only path that actually escrows the ceiling.
     *
     * @throws {InvalidProofError} when the authorization or the deposit
     *   broadcast fails.
     */
    verifyOpen(request: Request, maxPrice: Price): Promise<UptoVerified>;
    /**
     * Settle the metered amount (`actualBaseUnits`, clamped to the ceiling) against
     * a verified open: receiver-authorizer voucher, fee-payer-signed settle-and-seal,
     * refund the remainder.
     *
     * @throws {InvalidProofError} when settlement fails.
     */
    settle(verified: UptoVerified, actualBaseUnits: bigint): Promise<UptoSettlement>;
}

/**
 * Canonical PayKit error taxonomy, shared across the cross-language SDK
 * family (see docs/paykit-interface.md). Every error extends
 * {@link PayKitError} so callers can catch the whole family at once.
 */
/** Root of the PayKit error hierarchy. */
declare class PayKitError extends Error {
    name: string;
}
/** Boot-time configuration problem. Raised before any request is served. */
declare class ConfigurationError extends PayKitError {
    name: string;
}
/** The package-shipped demo signer was configured on mainnet. */
declare class DemoSignerOnMainnetError extends ConfigurationError {
    name: string;
}
/** A gate mixes prices denominated in different fiat currencies. */
declare class MixedCurrenciesError extends ConfigurationError {
    name: string;
}
/** A gate explicitly requests a protocol its shape is incompatible with (e.g. fees + x402). */
declare class ProtocolIncompatibleError extends ConfigurationError {
    name: string;
}
/** A gate name was not found in the configured pricing catalogue. */
declare class UnknownGateError extends ConfigurationError {
    name: string;
    constructor(gateName: string);
}
/** A signer secret could not be parsed (wrong length, bad encoding, unreadable file). */
declare class InvalidKeyError extends PayKitError {
    name: string;
}
/** The request carried no payment credential. Rendered as HTTP 402 with a challenge. */
declare class PaymentRequiredError extends PayKitError {
    name: string;
    readonly httpStatus = 402;
}
/**
 * The request carried a payment credential that failed verification or
 * settlement. Rendered as HTTP 402.
 */
declare class InvalidProofError extends PayKitError {
    name: string;
    readonly httpStatus = 402;
    /** Canonical cross-SDK machine code (e.g. `signature_consumed`), asserted by conformance. */
    readonly code: string;
    constructor(code: string, detail?: string);
}
/** The payment credential references a challenge that has expired. */
declare class ChallengeExpiredError extends InvalidProofError {
    name: string;
    constructor(detail?: string);
}
/** The client requested a payment protocol this server does not accept. Rendered as HTTP 406. */
declare class ProtocolNotSupportedError extends PayKitError {
    name: string;
    readonly httpStatus = 406;
}

/** A route discovered on an Express app: HTTP method, OpenAPI path, and its gate. */
type IntrospectedRoute = {
    gate: unknown;
    method: string;
    path: string;
};
type RouteLayer = {
    route?: {
        methods?: Record<string, boolean>;
        path?: string[] | string;
        stack?: {
            handle?: unknown;
        }[];
    };
};
/** The minimal Express-app shape this introspection needs (Express 4 or 5). */
type ExpressRoutesApp = {
    _router?: {
        stack?: RouteLayer[];
    };
    router?: {
        stack?: RouteLayer[];
    };
};
/**
 * Enumerate the gated routes mounted on an Express app.
 *
 * @param app - The Express application (or router) to introspect
 * @returns One entry per (method, path) guarded by a `pay.express` gate
 */
declare function introspectExpressRoutes(app: ExpressRoutesApp): IntrospectedRoute[];

/**
 * OpenAPI 3.1 discovery: a self-documenting `/openapi.json` describing a
 * server's priced routes. Each gated operation carries an `x-payment-info`
 * extension whose `offers[]` lists every way to pay (one per accepted
 * protocol/scheme), and the document root carries optional `x-service-info`.
 *
 * The extension shape mirrors mppx's discovery convention so the same tooling
 * reads it — augmented here so a single offer list spans both MPP (`charge`)
 * and x402 (`exact` / `upto`), which a multi-protocol PayKit server advertises.
 * Discovery is advisory; the runtime 402 challenge stays authoritative.
 */
/**
 * One way to pay for a route, in an operation's `x-payment-info.offers` list.
 * `intent` + `method` + `amount` are the fields required by the payment-discovery
 * draft (paymentauth.org/draft-payment-discovery-00); the rest are the spec's
 * optional fields plus pay-kit extras (`network`, `payTo`, `feePayer`, `scheme`)
 * that the runtime 402 challenge ultimately confirms.
 */
type PaymentOffer = {
    /** Base-unit integer amount (max, for `upto`); `null` when unpriced. */
    readonly amount: string | null;
    /** Settlement coin symbol, e.g. `"USDC"`. */
    readonly currency?: string;
    /** Human-readable price, e.g. `"0.01 USDC"` (or `"up to 0.10 USDC"`). */
    readonly description?: string;
    /** Fee-payer / facilitator address that sponsors settlement, when the scheme has one. */
    readonly feePayer?: string;
    /** Payment intent (discovery-draft required): `"charge"` for one-shot, `"session"` for metered streams. */
    readonly intent: string;
    /** Payment method/rail (discovery-draft required): the protocol, e.g. `"x402"` or `"mpp"`. */
    readonly method: string;
    /** CAIP-2 network. */
    readonly network?: string;
    /** Recipient address. */
    readonly payTo?: string;
    /** On-chain Plan PDA — present on `subscription` offers. */
    readonly planId?: string;
    /** Scheme: `"exact"` / `"upto"` (x402) or `"charge"` / `"subscription"` (MPP). */
    readonly scheme?: string;
    /** Per-delivery price in base units — present on `session` offers. */
    readonly unitPrice?: string;
};
/** Document-root `x-service-info` extension: service-level (not per-payment) metadata. */
type ServiceInfo = {
    readonly categories?: readonly string[];
    readonly docs?: {
        readonly apiReference?: string;
        readonly homepage?: string;
        readonly llms?: string;
    };
};
/** A resolved route for {@link buildOpenApiDocument}. */
type OpenApiRouteDoc = {
    readonly method: string;
    readonly offers: readonly PaymentOffer[] | null;
    readonly path: string;
    readonly requestBody?: Record<string, unknown>;
    readonly summary?: string;
};
/** `info` block of the generated document. */
type OpenApiInfo = {
    readonly title?: string;
    readonly version?: string;
};
/**
 * Build an OpenAPI 3.1 discovery document from resolved priced routes.
 *
 * @param config - The document info, routes (with payment offers), and optional service info
 * @returns The OpenAPI document object
 */
declare function buildOpenApiDocument(config: {
    info?: OpenApiInfo;
    routes: readonly OpenApiRouteDoc[];
    serviceInfo?: ServiceInfo;
}): Record<string, unknown>;

/** The minimal node request shape the middleware needs. Express requests satisfy it. */
type NodeRequest = IncomingMessage & {
    /** Express sets this to the full original path; plain node uses `url`. */
    readonly originalUrl?: string;
    /** Express sets this from the connection / trust-proxy settings. */
    readonly protocol?: string;
};
/** A node `ServerResponse`, re-exported so callers need not import `node:http`. */
type NodeResponse = ServerResponse;
/** Connect-style continuation. */
type NextFunction = (error?: unknown) => void;
/** The minimal context shape the Hono handler needs. Hono's `Context` satisfies it. */
type WebContext = {
    readonly req: {
        readonly raw: Request;
    };
    readonly res: Response;
};
/** Hono-style continuation. */
type WebNext = () => Promise<void>;

/** Gate parameters without a name (the catalogue key or inline context provides it). */
type InlineGateParams = Omit<GateParams, 'name'>;
/**
 * A usage-based (`upto`) gate definition: authorize up to `amount`, then settle
 * the metered amount the handler reports. Produced by {@link usage}.
 */
type UsageGateParams = Omit<InlineGateParams, 'feeOnTop' | 'feeWithin'> & {
    readonly kind: 'usage';
};
/**
 * A subscription gate definition: the first call activates a recurring on-chain
 * authorization against `subscription.planId`, then settles each period. MPP-only.
 * Produced by {@link subscription}.
 */
type SubscriptionGateParams = Omit<InlineGateParams, 'feeOnTop' | 'feeWithin'> & {
    readonly kind: 'subscription';
    readonly subscription: SubscriptionConfig;
};
/**
 * A session gate definition: open a payment channel capped at `amount`, meter
 * streamed deliveries at `session.unitPrice`, and settle out-of-band. MPP-only.
 * Produced by {@link session}.
 */
type SessionGateParams = Omit<InlineGateParams, 'feeOnTop' | 'feeWithin'> & {
    readonly kind: 'session';
    readonly session: SessionConfig;
};
/**
 * A request-evaluated gate definition. Returns either a bare {@link Price}
 * (an anonymous gate at that price) or full gate parameters.
 */
type GateResolver = (request: Request) => InlineGateParams | Price | Promise<InlineGateParams | Price>;
/**
 * A pricing catalogue definition: one entry per gate name. A value is a bare
 * {@link Price} (a fixed charge at that price), full {@link InlineGateParams}
 * (fees, splits, protocol override), a {@link usage} gate, or a
 * {@link GateResolver} evaluated per request.
 */
type PricingDef = Readonly<Record<string, GateResolver | InlineGateParams | Price>>;
/**
 * Declares a usage-based (`upto`) gate: the client authorizes up to `max`, the
 * handler reports actual consumption, and the gate settles that — never more
 * than `max` — refunding the rest. x402-only.
 *
 * @example
 * ```ts
 * pricing: { summarize: usage(usd('1.00')) }
 * ```
 *
 * @param max - The authorized ceiling
 * @param params - Optional description / externalId / payTo
 * @returns A usage gate definition
 */
declare function usage(max: Price, params?: Omit<UsageGateParams, 'amount' | 'kind'>): UsageGateParams;
/**
 * Declares a subscription gate: the first request activates a recurring on-chain
 * authorization against `planId`, debiting `amount` per period; subsequent
 * periods are pulled by `puller`. MPP-only.
 *
 * @example
 * ```ts
 * pricing: {
 *   feed: subscription(usd('0.10'), { planId, periodUnit: 'day', periodCount: 1, puller: operator }),
 * }
 * ```
 *
 * @param amount - The per-period charge
 * @param config - Plan binding (planId, periodUnit, periodCount, puller) plus optional description / payTo
 * @returns A subscription gate definition
 */
declare function subscription(amount: Price, config: Omit<SubscriptionGateParams, 'amount' | 'kind' | 'subscription'> & SubscriptionConfig): SubscriptionGateParams;
/**
 * Declares a session gate: the client opens a payment channel capped at `cap`,
 * the server meters streamed deliveries at `unitPrice` each, and settlement runs
 * out-of-band when the channel idle-closes. MPP-only.
 *
 * @example
 * ```ts
 * pricing: { stream: session(usd('1.00'), { unitPrice: usd('0.0001') }) }
 * ```
 *
 * @param cap - The authorized channel ceiling
 * @param config - Per-delivery `unitPrice` plus optional `closeDelayMs` / description / payTo
 * @returns A session gate definition
 */
declare function session(cap: Price, config: Omit<SessionGateParams, 'amount' | 'kind' | 'session'> & {
    closeDelayMs?: number;
    unitPrice: Price;
}): SessionGateParams;
/** A named gate whose shape is computed per request. */
declare class DynamicGate {
    #private;
    readonly name: string;
    constructor(name: string, resolver: GateResolver, defaults: GateDefaults);
    /** Materializes the gate for one request. */
    resolve(request: Request): Promise<Gate>;
}
/**
 * A named, boot-validated catalogue of gates.
 *
 * @example
 * ```ts
 * const pricing = createPricing(config, {
 *   marketplace: { amount: usd('10.00'), feeWithin: { [PLATFORM]: usd('0.30') }, payTo: SELLER },
 *   report: { amount: usd('0.10'), description: 'Premium report' },
 *   tiered: request => usd(new URL(request.url).searchParams.get('tier') === 'pro' ? '5.00' : '0.10'),
 * });
 * ```
 */
declare class Pricing {
    #private;
    constructor(gates: ReadonlyMap<string, DynamicGate | Gate>);
    /**
     * Looks up a gate by name.
     *
     * @throws {UnknownGateError} when the name is not registered.
     */
    gate(name: string): DynamicGate | Gate;
    /** All registered gate names. */
    names(): readonly string[];
}
/** Gate defaults derived from a boot config. */
declare function gateDefaults(config: PayKitConfig): GateDefaults;
/**
 * Builds a {@link Pricing} catalogue from gate definitions, resolving
 * defaults (recipient, accepted protocols) from the boot config. Static
 * definitions are validated immediately; resolver functions become
 * {@link DynamicGate}s evaluated per request.
 */
declare function createPricing(config: PayKitConfig, definitions: PricingDef): Pricing;

/**
 * A gate name from the configured pricing catalogue. With a concrete `pricing`
 * literal this is the union of its keys, so names autocomplete and a typo is a
 * compile error; with no pricing it widens to `string`.
 */
type GateName<P extends PricingDef> = string & keyof P;
/**
 * Anything that names a gate: a catalogue name (typed against `pricing`), a
 * {@link Gate}, a bare {@link Price} (anonymous inline gate), or a per-request
 * resolver.
 */
type GateRef<P extends PricingDef = PricingDef> = DynamicGate | Gate | GateName<P> | GateResolver | Price;
/** A priced route to advertise in the OpenAPI discovery document. */
type OpenApiRoute<P extends PricingDef = PricingDef> = {
    readonly gate: GateRef<P>;
    readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
    readonly path: string;
    readonly requestBody?: Record<string, unknown>;
    readonly summary?: string;
};
/** Options for {@link PayKit.openapi}. */
type OpenApiOptions = {
    readonly info?: OpenApiInfo;
    readonly serviceInfo?: ServiceInfo;
};
/** The request did not carry a valid payment; respond with `response`. */
type PaymentDenied = {
    readonly challenge: Challenge;
    readonly response: Response;
    readonly status: 402;
};
/**
 * The payment verified; reply through `withSettlement`. For `usage` gates the
 * `charge` meter records consumption and settlement runs when `withSettlement`
 * (or `settle`) is called; for fixed gates settlement already happened.
 */
type PaymentGranted = {
    /** Usage meter — present only for `usage` (upto) gates. */
    readonly charge: Charge | undefined;
    readonly payment: Payment;
    /** Runs settlement (for usage gates) and returns the headers to merge. Memoized. */
    readonly settle: () => Promise<Readonly<Record<string, string>>>;
    readonly status: 200;
    /** Returns `response` with the settlement headers merged in (settles usage gates). */
    readonly withSettlement: (response: Response) => Promise<Response>;
};
/**
 * Send `respond` verbatim — a protocol owns the response for an unpaid request
 * (e.g. MPP's HTML payment page or its service worker). Status comes from the
 * Response itself.
 */
type PaymentRespond = {
    readonly respond: Response;
};
/** Result of {@link PayKit.requirePayment}. */
type RequirePaymentResult = PaymentDenied | PaymentGranted | PaymentRespond;
/** Express/Connect-style middleware returned by {@link PayKit.express}. */
type ExpressMiddleware = (req: NodeRequest, res: NodeResponse, next: NextFunction) => Promise<void>;
/** Hono-style middleware returned by {@link PayKit.hono}. */
type HonoMiddleware = (c: WebContext, next: WebNext) => Promise<Response | undefined>;
/** A fetch-style route handler wrapped by {@link PayKit.fetch}. */
type FetchHandler = (request: Request, payment: Payment) => Promise<Response> | Response;
/** An Express request as seen by the session side-channel handlers (body/params parsed by Express). */
type SessionRouteRequest = NodeRequest & {
    readonly body?: unknown;
    readonly params?: Readonly<Record<string, string | undefined>>;
};
/**
 * The session side-channel + receipt handlers for a `session` gate, returned by
 * {@link PayKit.sessionRoutes}. Mount them explicitly (mppx-consistent — pay-kit
 * does not auto-mount):
 * ```ts
 * const s = pay.sessionRoutes('stream');
 * app.post('/__402/session/deliveries', s.deliveries);
 * app.post('/__402/session/commit', s.commit);
 * app.get('/sessions/receipt/:channelId', s.receipt);
 * ```
 */
type SessionRouteHandlers = {
    readonly commit: (req: SessionRouteRequest, res: NodeResponse) => Promise<void>;
    readonly deliveries: (req: SessionRouteRequest, res: NodeResponse) => Promise<void>;
    readonly receipt: (req: SessionRouteRequest, res: NodeResponse) => Promise<void>;
    /**
     * The resource-URL voucher-commit handler: the SessionFetchClient re-POSTs
     * each signed voucher (in the `Authorization` credential) to the URL it
     * opened against. Mount it there. Kept off the gated route so it isn't
     * advertised as a separate endpoint in discovery.
     */
    readonly voucher: (req: SessionRouteRequest, res: NodeResponse) => Promise<void>;
};
/**
 * The PayKit server instance: the canonical verb trio plus framework handlers,
 * over web-standard `Request`/`Response`. Created by {@link createPayKit}.
 */
type PayKit<P extends PricingDef = PricingDef> = {
    /** Whether `request` carries a usage meter for the current route (usage gates only). */
    readonly charge: (request: object) => Charge | undefined;
    readonly config: PayKitConfig;
    /** Express / Connect / Polka middleware gating downstream handlers on `gate`. */
    readonly express: (gate: GateRef<P>) => ExpressMiddleware;
    /** Wrap a fetch-style handler (Workers / Bun / Deno / Next route handlers). */
    readonly fetch: (gate: GateRef<P>, handler: FetchHandler) => (request: Request) => Promise<Response>;
    /** Hono middleware gating downstream handlers on `gate`. */
    readonly hono: (gate: GateRef<P>) => HonoMiddleware;
    /** Build an OpenAPI 3.1 discovery document (`x-payment-info` per route) for the given priced routes. */
    readonly openapi: (routes: readonly OpenApiRoute<P>[], options?: OpenApiOptions) => Promise<Record<string, unknown>>;
    /** Like {@link openapi}, but discovers the routes by introspecting a mounted Express app. */
    readonly openapiFromExpress: (app: ExpressRoutesApp, options?: OpenApiOptions) => Promise<Record<string, unknown>>;
    /** Whether `request` already carries a verified payment (optionally for a specific gate). */
    readonly paid: (request: object, gate?: GateName<P>) => boolean;
    /** The verified payment on `request`, if any. */
    readonly payment: (request: object) => Payment | undefined;
    /**
     * Verify-or-deny: settles a credential (or opens a usage channel) or
     * produces the 402 challenge. For a `usage` gate the returned
     * {@link PaymentGranted} holds an in-flight channel reservation released
     * only when its `settle` (or `withSettlement`) runs; a caller driving
     * `requirePayment` directly must call one of them, as the framework
     * wrappers do.
     */
    readonly requirePayment: (request: Request, gate: GateRef<P>) => Promise<RequirePaymentResult>;
    /** The side-channel + receipt handlers for a `session` gate, for the app to mount. */
    readonly sessionRoutes: (gate: Gate | GateName<P>) => SessionRouteHandlers;
};
/** Options for {@link createPayKit}: the boot config plus pricing and adapter overrides. */
type CreatePayKitOptions<P extends PricingDef> = ConfigureParams & {
    /** Protocol adapters; defaults are derived from `accept`. */
    readonly adapters?: readonly ProtocolAdapter[];
    /** A pre-built, frozen config — skips the internal {@link configure} call. */
    readonly config?: PayKitConfig;
    /**
     * Invoked when settlement fails after the handler has run, so the request is
     * served without settlement headers. Use it to route the event to a logger or
     * alerting pipeline; a failed settlement is a payment event worth surfacing.
     * Defaults to a `console.warn`.
     */
    readonly onSettleError?: (error: unknown) => void;
    /** The gate catalogue, inline. Gate names become typed on the returned instance. */
    readonly pricing?: P;
};
/**
 * Creates a PayKit instance from a single config object: network + operator +
 * accepted protocols + the inline `pricing` catalogue. Gate names are inferred
 * from `pricing`, so `pay.express('report')` autocompletes and a typo is a
 * compile error.
 *
 * @example
 * ```ts
 * const pay = await createPayKit({
 *   network: 'devnet',
 *   operator: { signer: await Signer.env('OPERATOR_KEY'), recipient: MERCHANT },
 *   pricing: {
 *     report: usd('0.10'),
 *     api: { amount: usd('0.001'), accept: ['x402'] },
 *     summarize: usage(usd('1.00')),
 *   },
 * });
 *
 * app.get('/report', pay.express('report'), (_req, res) => res.json({ ok: true }));
 * ```
 *
 * @param options - Boot config + `pricing` + optional adapter/config overrides
 * @returns The PayKit instance
 */
declare function createPayKit<const P extends PricingDef = PricingDef>(options?: CreatePayKitOptions<P>): Promise<PayKit<P>>;

export { type AcceptsEntry, type Challenge, ChallengeExpiredError, Charge, ConfigurationError, type ConfigureParams, type CreatePayKitOptions, type Currency, DemoSignerOnMainnetError, DynamicGate, type ExpressMiddleware, type ExpressRoutesApp, type Fee, type FeeKind, type FeeSpec, type FetchHandler, Gate, type GateDefaults, type GateKind, type GateName, type GateParams, type GateRef, type GateResolver, type HonoMiddleware, type InlineGateParams, type IntrospectedRoute, InvalidKeyError, InvalidProofError, type KeychainSigner, MixedCurrenciesError, type MppOptions, Network, NetworkSlug, type OpenApiInfo, type OpenApiOptions, type OpenApiRoute, type OpenApiRouteDoc, type Operator, type OperatorParams, type PayKit, type PayKitConfig, PayKitError, type PayKitSigner, type Payment, type PaymentDenied, type PaymentGranted, type PaymentOffer, PaymentRequiredError, type PaymentRespond, Price, Pricing, type PricingDef, Protocol, type ProtocolAdapter, ProtocolIncompatibleError, ProtocolNotSupportedError, type RequirePaymentResult, STABLECOINS, type ServiceInfo, type SessionConfig, type SessionGateParams, type SessionRouteHandlers, type SessionRouteRequest, Signer, type Stablecoin, type SubscriptionConfig, type SubscriptionGateParams, UnknownGateError, type UptoSettlement, type UptoVerified, type UsageGateParams, type X402Options, X402Upto, buildOpenApiDocument, configure, configureFromEnv, createPayKit, createPricing, eur, gateDefaults, gbp, introspectExpressRoutes, session, subscription, usage, usd };

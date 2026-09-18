import { KeyPairSigner } from '@solana/kit';
import { P as Protocol } from '../protocol-j0_UHGHD.js';

/**
 * `@solana/pay-kit/client` — the client counterpart to {@link import('../paykit.js').createPayKit}.
 *
 * A single config-object factory returns a payment-aware `fetch`: it issues the
 * request, and on a `402` it reads the challenge, pays with the right protocol,
 * and retries — dispatching by the challenge header (x402's `payment-required`
 * vs MPP's `www-authenticate`). The shape mirrors the Rust client's
 * parse-challenge → build-header → retry flow, packaged as one instance like
 * the server's `createPayKit`.
 *
 * Protocols stay invisible to callers: `accept` is the only knob, and one
 * `signer` drives both rails (an `@solana/kit` `KeyPairSigner` satisfies the
 * x402 `ClientSvmSigner` and the MPP client methods).
 */

/** Options for {@link createPayKitClient}. */
type PayKitClientOptions = {
    /** Protocols the client will pay with. Defaults to `['x402', 'mpp']`. */
    readonly accept?: readonly Protocol[];
    /** Progress callback, forwarded to the MPP charge/subscription methods. */
    readonly onProgress?: (event: unknown) => void;
    /**
     * x402 client spend controls. Defaults to the x402 core default (known
     * assets only, capped); pass `false` to disable, or a `SpendControls`
     * object (e.g. `{ allowedAssets: true }`) to allow non-default mints —
     * needed for localnet stand-in mints.
     */
    readonly spendControls?: unknown;
    /** RPC endpoint used to build payments (sign transfers, open channels). */
    readonly rpcUrl: string;
    /** The payer signer — drives both x402 and MPP. */
    readonly signer: KeyPairSigner;
};
/** The PayKit client instance: a payment-aware `fetch`. */
type PayKitClient = {
    /**
     * Like `fetch`, but transparently settles a `402`: reads the challenge,
     * pays with the matching protocol, and retries. Non-402 responses pass
     * through untouched. When the server offers more than one protocol, pass
     * `protocol` to force one (e.g. `'x402'`); otherwise MPP is preferred.
     */
    readonly fetch: (input: RequestInfo | URL, init?: RequestInit, protocol?: Protocol) => Promise<Response>;
};
/**
 * Creates a PayKit client: a `fetch` that pays `402`s over x402 or MPP,
 * dispatched by the server's challenge. The client counterpart to
 * {@link import('../paykit.js').createPayKit}.
 *
 * @example
 * ```ts
 * const client = await createPayKitClient({ signer, rpcUrl, accept: ['x402', 'mpp'] });
 * const res = await client.fetch('/x402/joke');
 * ```
 *
 * @param options - Signer, RPC, accepted protocols, optional progress callback
 * @returns The client instance
 */
declare function createPayKitClient(options: PayKitClientOptions): Promise<PayKitClient>;

export { type PayKitClient, type PayKitClientOptions, createPayKitClient };

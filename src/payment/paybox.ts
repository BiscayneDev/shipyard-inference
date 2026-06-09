import type { AgentResponse, PayboxClient } from '@paybox-sh/sdk'
import {
  type PaymentProvider,
  type PaymentRequirement,
  type PaymentResult,
  type SolanaSigner,
  MissingDependencyError,
  PaymentError,
} from './types.js'

/** Polling knobs shared by every Paybox helper. */
interface PollOptions {
  /** Poll interval while a request is pending. */
  pollIntervalMs?: number
  /** Give up awaiting approval/signature after this long (default 120s). */
  approvalTimeoutMs?: number
}

/**
 * Load the real `@paybox-sh/sdk` at call time (it's an optional peer, so
 * non-Paybox users never need it). The package imports cleanly at runtime; its
 * only unresolved reference is a type-level one, ignored under `skipLibCheck`.
 */
async function loadPayboxClient(
  explicit: PayboxClient | undefined,
): Promise<PayboxClient> {
  if (explicit) return explicit
  try {
    const mod = await import('@paybox-sh/sdk')
    return mod.PayboxClient.fromConfig()
  } catch (err) {
    if (err instanceof Error && /Cannot find|MODULE_NOT_FOUND|ERR_MODULE/.test(err.message)) {
      throw new MissingDependencyError('@paybox-sh/sdk', 'the Paybox payment adapter')
    }
    throw err
  }
}

export interface PayboxPaymentProviderOptions {
  /** Pre-built client. Defaults to `PayboxClient.fromConfig()`. */
  client?: PayboxClient
  /** Card credential to charge. */
  credentialId: string
  /** Merchant name reported to Paybox. */
  merchant: string
  /** Merchant URL reported to Paybox. */
  merchantUrl: string
  /** ISO currency for the charge (e.g. `USD`). */
  currency?: string
  /** Poll interval while awaiting passkey approval. */
  pollIntervalMs?: number
  /** Give up awaiting approval after this long (default 120s). */
  approvalTimeoutMs?: number
  /**
   * Convert a 402 requirement to integer cents. Defaults to treating the atomic
   * amount as 6-decimal USDC (atomic / 10_000 = cents). Override for other
   * assets/decimals.
   */
  toAmountCents?: (requirement: PaymentRequirement) => number
}

function defaultToCents(requirement: PaymentRequirement): number {
  // USDC has 6 decimals; cents = atomic / 1e4.
  return Math.round(Number(BigInt(requirement.amount)) / 10_000)
}

/** Resolve an AgentResponse, polling through any pending/approval state. */
async function resolveResponse(
  client: PayboxClient,
  response: AgentResponse,
  opts: PollOptions,
): Promise<AgentResponse> {
  let current = response
  if (current.status === 'pending_approval' || current.status === 'pending_signature') {
    current = await client.waitForRequest(current.request_id, {
      intervalMs: opts.pollIntervalMs,
      timeoutMs: opts.approvalTimeoutMs,
    })
  }
  if (current.status !== 'success') {
    throw new PaymentError(
      `Paybox request ${current.request_id} ended '${current.status}'` +
        (current.error ? `: ${current.error}` : ''),
    )
  }
  return current
}

/**
 * A `PaymentProvider` that settles x402 challenges through Paybox's
 * card/merchant flow (`requestPayment`). Paybox returns a `payment_token` after
 * scoped, passkey-gated approval; that token is attached as the proof header on
 * retry. `pay` is idempotent per nonce so a retried request never double-charges.
 *
 * This adapter is for endpoints that bill via a Paybox *card* credential. For
 * *on-chain USDC* x402, use `payboxSigner` (a non-custodial Solana signer backed
 * by a Paybox wallet credential) with `createSolanaPayProvider`.
 */
export async function createPayboxPaymentProvider(
  options: PayboxPaymentProviderOptions,
): Promise<PaymentProvider> {
  const client = await loadPayboxClient(options.client)
  const toCents = options.toAmountCents ?? defaultToCents
  const settled = new Map<string, PaymentResult>()

  return {
    async pay(requirement: PaymentRequirement): Promise<PaymentResult> {
      const key = requirement.nonce ?? `${requirement.resource}|${requirement.amount}`
      const cached = settled.get(key)
      if (cached) return cached

      const response = await resolveResponse(
        client,
        await client.requestPayment({
          credentialId: options.credentialId,
          merchant: options.merchant,
          merchantUrl: options.merchantUrl,
          amountCents: toCents(requirement),
          currency: options.currency,
        }),
        options,
      )

      const token = response.output?.value
      if (token == null) {
        throw new PaymentError(
          `Paybox request ${response.request_id} succeeded but returned no payment token`,
        )
      }

      const result: PaymentResult = {
        header: typeof token === 'string' ? token : JSON.stringify(token),
        reference: response.request_id,
        amount: requirement.amount,
      }
      settled.set(key, result)
      return result
    },
  }
}

export interface PayboxSignerOptions extends PollOptions {
  /** Pre-built client. Defaults to `PayboxClient.fromConfig()`. */
  client?: PayboxClient
  /** Wallet-kind credential to sign with. */
  credentialId: string
  /** Payer base58 public key. Derived from the credential's metadata when omitted. */
  publicKey?: string
  /** CAIP-2 chain. Derived from `network` when omitted. */
  chain?: string
  /** Solana cluster used to derive `chain`. Default `mainnet`. */
  network?: 'mainnet' | 'devnet'
}

async function resolvePayerAddress(
  client: PayboxClient,
  options: PayboxSignerOptions,
): Promise<string> {
  if (options.publicKey) return options.publicKey
  const credentials = await client.listCredentials()
  const match = credentials.find((c) => c.credential.id === options.credentialId)
  const address = match?.credential.metadata?.address
  if (typeof address === 'string' && address) return address
  throw new PaymentError(
    'payboxSigner could not determine the wallet address — pass `publicKey`',
  )
}

/**
 * A `SolanaSigner` backed by a Paybox wallet credential. `signTransaction`
 * submits a `solanaTransaction` sign intent — Paybox signs non-custodially
 * (private key never reaches us, the agent, or the model) behind scoped,
 * passkey-gated approval, and returns the signed serialized transaction. Pass it
 * as the `signer` to `createSolanaPayProvider` to settle on-chain USDC x402
 * without a raw hot-wallet key in your environment.
 */
export async function payboxSigner(
  options: PayboxSignerOptions,
): Promise<SolanaSigner> {
  const client = await loadPayboxClient(options.client)
  const publicKey = await resolvePayerAddress(client, options)
  const chain =
    options.chain ?? (options.network === 'devnet' ? 'solana:devnet' : 'solana:mainnet-beta')

  return {
    publicKey,
    async signTransaction(tx: Uint8Array): Promise<Uint8Array> {
      const response = await resolveResponse(
        client,
        await client.requestWalletSign({
          credentialId: options.credentialId,
          chain,
          intent: {
            op: 'solanaTransaction',
            address: publicKey,
            transactionBase64: Buffer.from(tx).toString('base64'),
          },
        } as Parameters<PayboxClient['requestWalletSign']>[0]),
        options,
      )
      const signed = response.output?.value
      if (typeof signed !== 'string') {
        throw new PaymentError(
          `Paybox wallet sign ${response.request_id} returned no signed transaction`,
        )
      }
      return new Uint8Array(Buffer.from(signed, 'base64'))
    },
  }
}

export interface PayboxSecretOptions extends PollOptions {
  /** Pre-built client. Defaults to `PayboxClient.fromConfig()`. */
  client?: PayboxClient
  /** Secret-kind credential to reveal. */
  credentialId: string
  /** `true` returns plaintext; `false` (default) returns a one-time mediated token. */
  raw?: boolean
  /** Reason shown at approval and recorded in the audit log. */
  purpose?: string
}

/**
 * Reveal a secret credential (e.g. a provider API key) vaulted in Paybox, behind
 * scoped, passkey-gated approval. Use it to source `apiKey` for a provider so
 * keys live in the vault instead of your environment. Prefer `raw: false` so the
 * plaintext never transits the model.
 */
export async function payboxSecret(options: PayboxSecretOptions): Promise<string> {
  const client = await loadPayboxClient(options.client)
  const response = await resolveResponse(
    client,
    await client.requestSecret({
      credentialId: options.credentialId,
      raw: options.raw,
      purpose: options.purpose,
    }),
    options,
  )
  const value = response.output?.value
  if (value == null) {
    throw new PaymentError(`Paybox secret ${response.request_id} returned no value`)
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

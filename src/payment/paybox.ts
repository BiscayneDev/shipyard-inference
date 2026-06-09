import type { AgentResponse, PayboxClient } from '@paybox-sh/sdk'
import {
  type PaymentProvider,
  type PaymentRequirement,
  type PaymentResult,
  MissingDependencyError,
  PaymentError,
} from './types.js'

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
  opts: PayboxPaymentProviderOptions,
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
 * Note: Paybox's wallet-sign path is intent-based and submits on-chain itself,
 * so for *on-chain USDC* x402 use `keypairSigner` + `createSolanaPayProvider`
 * instead. This adapter is for endpoints that bill via a Paybox card credential.
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

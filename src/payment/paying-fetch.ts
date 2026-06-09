import {
  type PayingFetchOptions,
  type PaymentRequirement,
  PaymentError,
  SpendCapError,
} from './types.js'

function parseAtomic(value: string): bigint {
  try {
    return BigInt(value)
  } catch {
    throw new PaymentError(`Invalid atomic amount: '${value}'`)
  }
}

/** Default parser for an x402-style 402 challenge body. */
async function defaultParse402(response: Response): Promise<PaymentRequirement> {
  let body: Record<string, unknown> = {}
  try {
    body = (await response.json()) as Record<string, unknown>
  } catch {
    throw new PaymentError('Could not parse 402 challenge body as JSON')
  }

  const accepts = body.accepts
  const accept = (Array.isArray(accepts) ? accepts[0] : body) as
    | Record<string, unknown>
    | undefined
  if (!accept || typeof accept !== 'object') {
    throw new PaymentError('402 challenge contained no payment requirements')
  }

  const amount = accept.maxAmountRequired ?? accept.amount
  if (accept.payTo == null || amount == null) {
    throw new PaymentError('402 challenge missing payTo/amount')
  }

  return {
    scheme: typeof accept.scheme === 'string' ? accept.scheme : 'exact',
    network: typeof accept.network === 'string' ? accept.network : 'solana-mainnet',
    asset: String(accept.asset ?? ''),
    amount: String(amount),
    payTo: String(accept.payTo),
    resource: typeof accept.resource === 'string' ? accept.resource : response.url,
    nonce: typeof accept.nonce === 'string' ? accept.nonce : undefined,
    expiresAt: typeof accept.expiresAt === 'number' ? accept.expiresAt : undefined,
    raw: accept,
  }
}

type FetchInput = Parameters<typeof fetch>[0]

function mergeHeaders(
  input: FetchInput,
  init: RequestInit | undefined,
  name: string,
  value: string,
): Headers {
  const headers = new Headers()
  if (input instanceof Request) {
    input.headers.forEach((v, k) => headers.set(k, v))
  }
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v))
  }
  headers.set(name, value)
  return headers
}

/**
 * Wrap a `fetch` so HTTP 402 responses are settled and retried automatically.
 * Pass the result as a provider's `fetch` option and payment becomes invisible
 * to `chat()` and to `Router`.
 *
 * Money-safety: `maxPaymentRetries` defaults to 1 so a server that re-challenges
 * never causes a payment loop; spend caps are enforced per-request and
 * cumulatively per fetch instance; and `PaymentProvider.pay` is expected to be
 * idempotent per nonce so a single logical request settles at most once.
 */
export function createPayingFetch(opts: PayingFetchOptions): typeof fetch {
  const underlying = opts.fetch ?? globalThis.fetch
  const maxRetries = opts.maxPaymentRetries ?? 1
  const headerName = opts.paymentHeader ?? 'X-PAYMENT'
  const parse = opts.parse402 ?? defaultParse402
  const perRequestCap =
    opts.spendCap?.perRequest !== undefined ? parseAtomic(opts.spendCap.perRequest) : undefined
  const perProcessCap =
    opts.spendCap?.perProcess !== undefined ? parseAtomic(opts.spendCap.perProcess) : undefined
  let spentThisProcess = 0n

  const payingFetch = async (
    input: FetchInput,
    init?: RequestInit,
  ): Promise<Response> => {
    let currentInit = init
    // MPP: attach the session voucher to every request so the server debits the
    // session instead of 402-ing per call.
    if (opts.session) {
      currentInit = {
        ...currentInit,
        headers: mergeHeaders(
          input,
          currentInit,
          opts.session.headerName ?? headerName,
          opts.session.header,
        ),
      }
    }
    let response = await underlying(input, currentInit)
    let retries = 0

    while (response.status === 402 && retries < maxRetries) {
      const requirement = await parse(response.clone())
      const amount = parseAtomic(requirement.amount)

      if (perRequestCap !== undefined && amount > perRequestCap) {
        throw new SpendCapError(
          `Payment of ${amount} exceeds per-request cap of ${perRequestCap}`,
        )
      }
      if (perProcessCap !== undefined && spentThisProcess + amount > perProcessCap) {
        throw new SpendCapError(
          `Payment of ${amount} would exceed per-process cap of ${perProcessCap} ` +
            `(already spent ${spentThisProcess})`,
        )
      }

      const result = await opts.paymentProvider.pay(requirement)
      spentThisProcess += parseAtomic(result.amount)
      opts.onPayment?.({ ...result, resource: requirement.resource })

      currentInit = {
        ...currentInit,
        headers: mergeHeaders(input, currentInit, headerName, result.header),
      }
      response = await underlying(input, currentInit)
      retries++
    }

    return response
  }

  return payingFetch as typeof fetch
}

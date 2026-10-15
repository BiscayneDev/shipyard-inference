/**
 * Channel close — settle the accumulated draw on-chain in ONE transaction.
 *
 * A wallet-bound key with an open `upto` payment channel (bound by an earlier
 * top-up) accumulates draws against the credit ledger during the session —
 * all off-chain, zero gas per request. Closing the channel signs ONE voucher
 * for the accumulated (net) draw and settles on-chain: the payee is paid the
 * draw, the payer is refunded the remainder. This is what makes the balance
 * cryptographically verifiable instead of a trusted server number — in one gas
 * fee for the whole session, not per request.
 */
import type { Context } from 'hono'
import type { GatewayConfig } from './config.js'
import type { Account } from './keys.js'
import type { ChannelStore } from './channels.js'
import { settleChannelClose } from './x402-upto.js'
import type { UptoSettlement } from './x402-upto.js'

export interface CloseResult {
  status: number
  body: Record<string, unknown>
}

/**
 * Handle `POST /v1/channels/close` for the authenticated caller.
 * `drawUsd` optional; when omitted the caller's FULL ledger balance is used.
 */
export async function handleChannelClose(
  config: GatewayConfig,
  account: Account | undefined,
  channels: ChannelStore | undefined,
  rawBody: unknown,
): Promise<CloseResult> {
  if (!account) {
    return { status: 401, body: { error: 'Invalid API key', code: 'authentication_error' } }
  }
  if (!channels) {
    return { status: 501, body: { error: 'channel close not available on this deployment', code: 'not_supported' } }
  }
  if (!config.x402 || config.x402.scheme !== 'upto') {
    return { status: 501, body: { error: 'channel close requires the upto (payment channel) scheme', code: 'scheme_mismatch' } }
  }

  const balanceAccount = account.userId
  const open = await channels.active(balanceAccount)
  if (!open) {
    return { status: 404, body: { error: 'no open payment channel on this key', code: 'no_channel' } }
  }
  if (!open.settle) {
    return { status: 409, body: { error: 'this channel has no retained settlement data to close against', code: 'no_settle_data' } }
  }

  const body = (rawBody ?? {}) as { drawUsd?: unknown }
  const drawUsd =
    typeof body.drawUsd === 'number' && Number.isFinite(body.drawUsd)
      ? body.drawUsd
      : await config.creditStore?.balance(balanceAccount)

  if (drawUsd === undefined || !Number.isFinite(drawUsd) || drawUsd < 0) {
    return { status: 400, body: { error: '`drawUsd` must be a non-negative number', code: 'invalid_draw' } }
  }

  // One signed voucher + one on-chain settle for the accumulated (net) draw.
  let settlement: UptoSettlement
  try {
    settlement = await settleChannelClose(config.x402, {
      channelId: open.channelId,
      from: open.settle.payload.payload.from as string,
      expiresAt: open.settle.payload.payload.expiresAt as number,
      payload: open.settle.payload,
      requirements: open.settle.requirements,
      maxBaseUnits: BigInt(open.ceilingBaseUnits),
      drawBaseUnits: BigInt(Math.round(drawUsd * 1_000_000)),
    })
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : String(err)
    return {
      status: 502,
      body: { error: message, code: 'settle_failed', channelId: open.channelId },
    }
  }

  // Seal the ledger: move the settled draw out so it can't be re-drawn.
  const settledUsd = Number(settlement.amountBaseUnits) / 1e6
  if (config.creditStore) {
    await config.creditStore
      .accrue({
        account: balanceAccount,
        amountUsd: -settledUsd,
        placementId: 'channel_close',
        line: `channel close ${settledUsd.toFixed(6)} USDC (tx ${settlement.transaction})`,
        requestId: `close_${open.channelId}`,
        at: Date.now(),
      })
      .catch(() => {})
  }
  // The channel is now closed/withdrawn — drop it so a re-open records fresh.
  await channels.record({
    ...open,
    // Mark closed by zeroing the retained settle data; keep the identity for
    // the audit trail until a re-open replaces it.
    settle: undefined,
  })

  config.onX402Payment?.({
    payer: open.payer,
    signature: settlement.transaction,
    amountUsdc: settledUsd,
  })

  return {
    status: 200,
    body: {
      settledUsd,
      refundedUsd: open.ceilingUsd - settledUsd,
      channelId: open.channelId,
      transaction: settlement.transaction,
      balanceUsd: await config.creditStore?.balance(balanceAccount) ?? 0,
    },
  }
}

/** Hono handler wiring. */
export function channelCloseRoute(config: GatewayConfig) {
  return async (c: Context): Promise<Response> => {
    const auth = await resolveAuthForClose(config, c)
    let rawBody: unknown
    try {
      rawBody = await c.req.json()
    } catch {
      rawBody = {}
    }
    const result = await handleChannelClose(config, auth, config.channelStore, rawBody)
    return Response.json(result.body, { status: result.status })
  }
}

async function resolveAuthForClose(config: GatewayConfig, c: Context): Promise<Account | undefined> {
  const header = c.req.header('authorization')
  if (!config.keyStore || !header) return undefined
  try {
    return await config.keyStore.resolve(header.replace(/^Bearer\s+/i, ''))
  } catch {
    return undefined
  }
}

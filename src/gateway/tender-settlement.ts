import { Hono } from 'hono'
import type { Claim, TenderSettlementStore } from '../tender/settlement-store.js'
export interface PreparedPayout { signature: string; network: string; broadcast(): Promise<void> }
export function createTenderSettlementRoutes(opts: {
  store?: TenderSettlementStore
  account(header: string | undefined): Promise<{ userId: string; wallet?: string } | undefined>
  prepare(claim: Claim): Promise<PreparedPayout>
  minClaimUsd: number
  minImpressionIntervalMs: number
}) {
  const app = new Hono()
  app.post('/api/tender/claim', async c => {
    const account = await opts.account(c.req.header('authorization'))
    if (!account) return c.json({ error: 'unauthorized' }, 401)
    if (!account.wallet) return c.json({ error: 'no payout wallet on this key' }, 400)
    if (!opts.store) return c.json({ error: 'Durable Tender accounting is required' }, 503)
    let claim: Claim | undefined
    try { claim = await opts.store.reserve(account.userId, account.wallet, opts.minClaimUsd) }
    catch { return c.json({ error: 'Tender accounting unavailable; no payout started' }, 503) }
    if (!claim) return c.json({ error: 'Nothing available or an earlier claim needs reconciliation' }, 409)
    try {
      const tx = await opts.prepare(claim)
      // Persist the exact signed identity BEFORE any broadcast. If persistence fails,
      // nothing is sent. Unknown outcomes retain the debit and block another claim.
      await opts.store.prepared(claim.id, tx.signature, tx.network)
      await tx.broadcast()
      await opts.store.confirmed(claim.id, tx.signature)
      return c.json({ paid: true, claimId: claim.id, amountUsdc: claim.amountUsd, wallet: claim.wallet, signature: tx.signature })
    } catch {
      return c.json({ error: 'Claim held for reconciliation; do not retry the transfer', claimId: claim.id }, 202)
    }
  })
  app.post('/api/tender/impression', async c => {
    const account = await opts.account(c.req.header('authorization'))
    if (!account) return c.json({ error: 'unauthorized' }, 401)
    if (!opts.store) return c.json({ error: 'Durable Tender accounting is required' }, 503)
    try { return c.json(await opts.store.impression(account.userId, opts.minImpressionIntervalMs)) }
    catch { return c.json({ error: 'Tender accounting unavailable' }, 503) }
  })
  return app
}

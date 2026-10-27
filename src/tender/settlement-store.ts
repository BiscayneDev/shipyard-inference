/** Atomic hosted Tender accounting. RPCs and tables ship in the accompanying migration. */
export interface Claim { id: string; account: string; wallet: string; amountUsd: number }
export interface TenderSettlementStore {
  reserve(account: string, wallet: string, minUsd: number): Promise<Claim | undefined>
  prepared(id: string, signature: string, network: string, identity: { signer: string; mint: string; blockhash: string; lastValidBlockHeight: number }): Promise<void>
  confirmed(id: string, signature: string): Promise<void>
  routed(account: string, placementId: string, requestId: string): Promise<number>
  impression(account: string, minIntervalMs: number): Promise<{ accrued: number; line?: string; campaignId?: string }>
}
export class SupabaseTenderSettlementStore implements TenderSettlementStore {
  constructor(private opts: { url: string; key: string; fetch?: typeof fetch }) {}
  private async rpc<T>(fn: string, args: object): Promise<T> {
    const r = await (this.opts.fetch ?? fetch)(`${this.opts.url.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: this.opts.key, authorization: `Bearer ${this.opts.key}`, 'content-type': 'application/json' }, body: JSON.stringify(args),
    })
    if (!r.ok) throw new Error(`Tender accounting unavailable (${r.status})`)
    return await r.json() as T
  }
  async reserve(account: string, wallet: string, minUsd: number) {
    const rows = await this.rpc<Array<{ id: string; account: string; wallet: string; amount_usd: number }>>('shipyard_tender_reserve_claim', { p_account: account, p_wallet: wallet, p_min_usd: minUsd })
    const r = rows[0]
    return r ? { id: r.id, account: r.account, wallet: r.wallet, amountUsd: Number(r.amount_usd) } : undefined
  }
  async prepared(id: string, signature: string, network: string, identity: { signer: string; mint: string; blockhash: string; lastValidBlockHeight: number }) {
    if (await this.rpc<boolean>('shipyard_tender_prepare_claim', { p_id: id, p_signature: signature, p_network: network, p_identity: identity }) !== true) throw new Error('Claim preparation not persisted')
  }
  async confirmed(id: string, signature: string) {
    if (await this.rpc<boolean>('shipyard_tender_confirm_claim', { p_id: id, p_signature: signature }) !== true) throw new Error('Claim confirmation not persisted')
  }
  async routed(account: string, placementId: string, requestId: string) {
    return Number(await this.rpc<number>('shipyard_tender_routed_impression', { p_account: account, p_placement_id: placementId, p_request_id: requestId }))
  }
  async impression(account: string, minIntervalMs: number) {
    return this.rpc<{ accrued: number; line?: string; campaignId?: string }>('shipyard_tender_impression', { p_account: account, p_min_interval_ms: minIntervalMs })
  }
}

import { randomBytes } from 'node:crypto'
import type { Campaign, TargetingSpec } from './types.js'
import { impressionFloorUsdc } from './types.js'

// Advertiser self-serve: a campaign is funded inventory that enters the live
// Auction. This is the persistent source of truth (the in-memory Auction is the
// hot index, hydrated from here). No self-serve dashboard was in v1 — this adds
// it. Campaigns are GLOBAL: created once, they serve across every surface.

export interface CampaignInput {
  /** Sponsored status line (<= 80 chars). */
  line: string
  /** The marketplace x402 listing being promoted; "click" = the agent calls it. */
  endpointUrl: string
  /** Advertiser's wallet (escrow source / payout of the gross side). */
  advertiserWallet: string
  /** Bid per impression, USDC. Must be >= the derived floor. */
  usdcPerImpression: number
  /** USDC funded into the campaign; impressions = funded / bid. */
  fundedUsdc: number
  targeting?: TargetingSpec
  /** Lifecycle. Defaults to `active` (back-compat); self-serve passes `pending`. */
  status?: 'pending' | 'active'
  /** Solana Pay reference pubkey the funding deposit must carry (self-serve). */
  paymentReference?: string
}

/** Normalize a destination URL: lowercase the scheme, default to https://, http(s) only. */
function normalizeEndpointUrl(raw: string): string {
  let u = (raw ?? '').trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = u.replace(/^[a-z][a-z0-9+.-]*:\/\//i, (m) => m.toLowerCase())
  else u = 'https://' + u
  let parsed: URL
  try {
    parsed = new URL(u)
  } catch {
    throw new Error('campaign: `endpointUrl` is not a valid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('campaign: `endpointUrl` must be http(s)')
  }
  return parsed.toString()
}

/** Validate advertiser input and mint a Campaign (ids + impressions derived). */
export function buildCampaign(input: CampaignInput, at: number): Campaign {
  const line = (input.line ?? '').trim()
  if (!line) throw new Error('campaign: `line` is required')
  if (line.length > 80) throw new Error('campaign: `line` must be <= 80 chars')
  if (!input.endpointUrl?.trim()) throw new Error('campaign: `endpointUrl` is required')
  if (!input.advertiserWallet?.trim()) throw new Error('campaign: `advertiserWallet` is required')
  const floor = impressionFloorUsdc()
  if (!(input.usdcPerImpression >= floor)) {
    throw new Error(`campaign: usdcPerImpression must be >= floor ${floor}`)
  }
  if (!(input.fundedUsdc > 0)) throw new Error('campaign: fundedUsdc must be > 0')
  const remainingImpressions = Math.floor(input.fundedUsdc / input.usdcPerImpression)
  if (remainingImpressions < 1) throw new Error('campaign: funding buys < 1 impression at this bid')
  const id = randomBytes(6).toString('hex')
  return {
    campaignId: `cmp_${id}`,
    placementId: `plc_${id}`,
    line,
    endpointUrl: normalizeEndpointUrl(input.endpointUrl),
    advertiserWallet: input.advertiserWallet.trim(),
    usdcPerImpression: input.usdcPerImpression,
    remainingImpressions,
    fundedUsdc: input.fundedUsdc,
    targeting: input.targeting ?? {},
    status: input.status ?? 'active',
    paymentReference: input.paymentReference,
    createdAt: at,
  }
}

export interface CampaignStore {
  create(campaign: Campaign): Promise<Campaign>
  /** All campaigns (most recent first). */
  list(): Promise<Campaign[]>
  get(campaignId: string): Promise<Campaign | undefined>
  /** Patch fields on an existing campaign (e.g. flip to `active` once funded). */
  update(campaignId: string, patch: Partial<Campaign>): Promise<Campaign | undefined>
}

/** In-memory campaign store — process-local. */
export class MemoryCampaignStore implements CampaignStore {
  private readonly byId = new Map<string, Campaign>()

  async create(campaign: Campaign): Promise<Campaign> {
    this.byId.set(campaign.campaignId, { ...campaign })
    return campaign
  }
  async list(): Promise<Campaign[]> {
    return [...this.byId.values()].reverse()
  }
  async get(campaignId: string): Promise<Campaign | undefined> {
    return this.byId.get(campaignId)
  }
  async update(campaignId: string, patch: Partial<Campaign>): Promise<Campaign | undefined> {
    const existing = this.byId.get(campaignId)
    if (!existing) return undefined
    const next = { ...existing, ...patch, campaignId }
    this.byId.set(campaignId, next)
    return next
  }
}

export interface SupabaseCampaignStoreOptions {
  url: string
  key: string
  table?: string
  fetch?: typeof fetch
}

interface CampaignRow {
  campaign_id: string
  placement_id: string
  line: string
  endpoint_url: string
  advertiser_wallet: string
  usdc_per_impression: number
  remaining_impressions: number
  funded_usdc: number
  targeting: TargetingSpec
  status?: 'pending' | 'active' | null
  payment_reference?: string | null
  paid_signature?: string | null
  created_at?: number | null
}

/** Postgres-backed campaign store (PostgREST over fetch). Apply the schema first. */
export class SupabaseCampaignStore implements CampaignStore {
  private readonly base: string
  private readonly table: string
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch

  constructor(opts: SupabaseCampaignStoreOptions) {
    if (!opts.url) throw new Error('SupabaseCampaignStore: `url` is required')
    if (!opts.key) throw new Error('SupabaseCampaignStore: `key` is required')
    this.base = opts.url.replace(/\/+$/, '') + '/rest/v1'
    this.table = opts.table ?? 'shipyard_campaigns'
    this.fetchImpl = opts.fetch ?? fetch
    this.headers = {
      apikey: opts.key,
      authorization: `Bearer ${opts.key}`,
      'content-type': 'application/json',
    }
  }

  private toRow(c: Campaign): CampaignRow {
    return {
      campaign_id: c.campaignId,
      placement_id: c.placementId,
      line: c.line,
      endpoint_url: c.endpointUrl,
      advertiser_wallet: c.advertiserWallet,
      usdc_per_impression: c.usdcPerImpression,
      remaining_impressions: c.remainingImpressions,
      funded_usdc: c.fundedUsdc,
      targeting: c.targeting,
      status: c.status ?? 'active',
      payment_reference: c.paymentReference ?? null,
      paid_signature: c.paidSignature ?? null,
      created_at: c.createdAt ?? null,
    }
  }
  private fromRow(r: CampaignRow): Campaign {
    return {
      campaignId: r.campaign_id,
      placementId: r.placement_id,
      line: r.line,
      endpointUrl: r.endpoint_url,
      advertiserWallet: r.advertiser_wallet,
      usdcPerImpression: r.usdc_per_impression,
      remainingImpressions: r.remaining_impressions,
      fundedUsdc: r.funded_usdc,
      targeting: r.targeting ?? {},
      // Rows predating the payment columns have null status → treat as active.
      status: r.status ?? 'active',
      paymentReference: r.payment_reference ?? undefined,
      paidSignature: r.paid_signature ?? undefined,
      createdAt: r.created_at ?? undefined,
    }
  }

  async create(campaign: Campaign): Promise<Campaign> {
    const res = await this.fetchImpl(`${this.base}/${this.table}`, {
      method: 'POST',
      headers: { ...this.headers, prefer: 'return=minimal' },
      body: JSON.stringify([this.toRow(campaign)]),
    })
    if (!res.ok) throw new Error(`supabase campaign create failed: ${res.status} ${await res.text().catch(() => '')}`)
    return campaign
  }
  async list(): Promise<Campaign[]> {
    const res = await this.fetchImpl(`${this.base}/${this.table}?select=*&order=campaign_id.desc`, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase campaign list failed: ${res.status}`)
    return ((await res.json()) as CampaignRow[]).map((r) => this.fromRow(r))
  }
  async get(campaignId: string): Promise<Campaign | undefined> {
    const res = await this.fetchImpl(`${this.base}/${this.table}?select=*&campaign_id=eq.${campaignId}&limit=1`, { headers: this.headers })
    if (!res.ok) throw new Error(`supabase campaign get failed: ${res.status}`)
    const rows = (await res.json()) as CampaignRow[]
    return rows[0] ? this.fromRow(rows[0]) : undefined
  }
  async update(campaignId: string, patch: Partial<Campaign>): Promise<Campaign | undefined> {
    // Map only the patched fields to their columns (camel → snake).
    const map: Partial<Record<keyof Campaign, keyof CampaignRow>> = {
      line: 'line',
      endpointUrl: 'endpoint_url',
      advertiserWallet: 'advertiser_wallet',
      usdcPerImpression: 'usdc_per_impression',
      remainingImpressions: 'remaining_impressions',
      fundedUsdc: 'funded_usdc',
      targeting: 'targeting',
      status: 'status',
      paymentReference: 'payment_reference',
      paidSignature: 'paid_signature',
      createdAt: 'created_at',
    }
    const row: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k as keyof Campaign]
      if (col) row[col] = v
    }
    if (Object.keys(row).length === 0) return this.get(campaignId)
    const res = await this.fetchImpl(`${this.base}/${this.table}?campaign_id=eq.${campaignId}`, {
      method: 'PATCH',
      headers: { ...this.headers, prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`supabase campaign update failed: ${res.status} ${await res.text().catch(() => '')}`)
    const rows = (await res.json()) as CampaignRow[]
    return rows[0] ? this.fromRow(rows[0]) : undefined
  }
}

/** One-time schema for the campaigns table. */
export const SUPABASE_CAMPAIGNS_SCHEMA = `
create table if not exists shipyard_campaigns (
  campaign_id           text   primary key,
  placement_id          text   not null,
  line                  text   not null,
  endpoint_url          text   not null,
  advertiser_wallet     text   not null,
  usdc_per_impression   double precision not null,
  remaining_impressions bigint not null,
  funded_usdc           double precision not null,
  targeting             jsonb  not null default '{}',
  status                text   not null default 'active',
  payment_reference     text,
  paid_signature        text,
  created_at            bigint
);
-- Self-serve payment columns (idempotent for tables predating them):
alter table shipyard_campaigns add column if not exists status            text not null default 'active';
alter table shipyard_campaigns add column if not exists payment_reference text;
alter table shipyard_campaigns add column if not exists paid_signature    text;
alter table shipyard_campaigns add column if not exists created_at        bigint;
`

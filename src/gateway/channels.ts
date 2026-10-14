/**
 * Payment-channel registry (x402 `upto`).
 *
 * Binds an on-chain payment channel to a wallet-bound API key, so the key's
 * balance is provably backed by on-chain escrow rather than a server-side
 * float. When a key opens a channel via `/v1/topup` (upto scheme), the gateway
 * records the channel identity + ceiling here; subsequent keyed requests draw
 * down from the channel's remaining escrow, and the channel can be settled /
 * refunded on close (withdraw path).
 */
import type { CreditStore } from '../tender/credit-store.js'

/** A channel opened by a key, as recorded by the gateway after verification. */
export interface OpenChannel {
  /** The key's balance identity (account.userId). */
  account: string
  /** On-chain channel id from the verified upto open payload. */
  channelId: string
  /** Payer wallet (channel owner). */
  payer: string
  /** Ceiling escrowed, USDC (whole). */
  ceilingUsd: number
  /** Ceiling in atomic base units. */
  ceilingBaseUnits: string
  /** Unix-ms when the channel was opened. */
  openedAt: number
  /** On-chain open transaction signature, when available. */
  openSignature?: string
}

/**
 * Durable-ish registry of open channels by account. The CreditStore is the
 * source of truth for the remaining balance; this store binds that ledger to
 * the specific on-chain channel that funds it (for visibility + settlement).
 */
export interface ChannelStore {
  /** Record a newly verified open channel for an account. */
  record(channel: OpenChannel): Promise<void>
  /** The most recent open channel for an account, if any. */
  active(account: string): Promise<OpenChannel | undefined>
}

/** In-memory channel registry. One entry (the latest open) per account. */
export class MemoryChannelStore implements ChannelStore {
  private readonly byAccount = new Map<string, OpenChannel>()

  async record(channel: OpenChannel): Promise<void> {
    this.byAccount.set(channel.account, channel)
  }

  async active(account: string): Promise<OpenChannel | undefined> {
    return this.byAccount.get(account)
  }

  get size(): number {
    return this.byAccount.size
  }
}

/** No-op store: channel visibility off; balances still draw down via ledger. */
export class NoOpChannelStore implements ChannelStore {
  async record(_channel: OpenChannel): Promise<void> {
    /* no-op */
  }
  async active(_account: string): Promise<OpenChannel | undefined> {
    return undefined
  }
}

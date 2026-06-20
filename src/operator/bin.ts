#!/usr/bin/env node
import { serve } from '@hono/node-server'
import { TelemetryHub } from './hub.js'
import { JsonlTelemetryStore } from './store.js'
import { createOperatorConsole } from './server.js'
import { readTreasuryBalances, type TreasuryConfig } from './treasury.js'
import { SupabaseApiKeyStore } from '../gateway/keys.js'

function list(envVar: string): string[] {
  return (process.env[envVar] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main(): Promise<void> {
  const port = Number(process.env.SHIPYARD_OPERATOR_PORT ?? 8799)
  const dataDir = process.env.SHIPYARD_OPERATOR_DATA_DIR ?? './shipyard-operator-data'
  const retentionHours = Number(process.env.SHIPYARD_OPERATOR_RETENTION_HOURS ?? 48)
  const marginPct = Number(process.env.SHIPYARD_MARGIN_PCT ?? 15)

  const network = process.env.SHIPYARD_SETTLE_NETWORK === 'mainnet' ? 'mainnet' : 'devnet'
  const treasuries: TreasuryConfig[] = list('SHIPYARD_TREASURY_WALLET').map((address) => ({
    address,
    network,
    rpcUrl: process.env.SHIPYARD_SETTLE_RPC_URL,
    usdcMint: process.env.SHIPYARD_SETTLE_USDC_MINT,
  }))

  const hub = new TelemetryHub({
    store: new JsonlTelemetryStore(dataDir),
    retentionMs: retentionHours * 3_600_000,
    marginPct,
  })
  await hub.boot()

  const keyStore =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
      ? new SupabaseApiKeyStore({
          url: process.env.SUPABASE_URL,
          key: process.env.SUPABASE_SERVICE_KEY,
          table: process.env.SUPABASE_API_KEYS_TABLE,
        })
      : undefined

  const app = createOperatorConsole({
    hub,
    operatorTokens: list('SHIPYARD_OPERATOR_TOKEN'),
    ingestTokens: list('SHIPYARD_TELEMETRY_TOKEN'),
    treasuryConfigured: treasuries.length > 0,
    keyStore,
  })

  // Treasury balance poller (best-effort) — populates the billing panel.
  let pollTimer: NodeJS.Timeout | undefined
  if (treasuries.length > 0) {
    const poll = async (): Promise<void> => {
      hub.setTreasuryBalances(await readTreasuryBalances(treasuries))
    }
    void poll()
    pollTimer = setInterval(() => void poll(), 60_000)
    pollTimer.unref?.()
  }

  const server = serve({ fetch: app.fetch, port })
  console.log(`shipyard-operator → http://localhost:${port}`)
  console.log(`  store: ${dataDir}  · retention: ${retentionHours}h · margin: ${marginPct}%`)
  console.log(
    `  ingest: ${list('SHIPYARD_TELEMETRY_TOKEN').length || 'OPEN'} token(s) · ` +
      `operator: ${list('SHIPYARD_OPERATOR_TOKEN').length || 'OPEN'} token(s)`,
  )
  if (treasuries.length) console.log(`  treasury: ${treasuries.length} wallet(s) on ${network}`)

  const shutdown = (signal: string): void => {
    console.log(`\n${signal} received — shutting down`)
    if (pollTimer) clearInterval(pollTimer)
    server.close(() => void hub.close().then(() => process.exit(0)))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[shipyard-operator] failed to start:', err)
  process.exit(1)
})

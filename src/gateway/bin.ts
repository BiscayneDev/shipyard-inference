#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startGateway } from './serve.js'
import type { GatewayConfig } from './config.js'
import { createTelemetryReporter, type TelemetryReporter } from '../operator/reporter.js'
import { SupabaseApiKeyStore, type ApiKeyStore } from './keys.js'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

async function main(): Promise<void> {
  const configPath = arg('--config')
  if (!configPath) {
    console.error('Usage: shipyard-gateway --config <path-to-config.(js|mjs)> [--port <n>]')
    console.error(
      'The config module must default-export a GatewayConfig (with `candidates`).',
    )
    process.exit(1)
  }

  const mod = (await import(pathToFileURL(resolve(configPath)).href)) as {
    default?: GatewayConfig
    config?: GatewayConfig
  }
  const config = mod.default ?? mod.config
  if (!config || !Array.isArray(config.candidates)) {
    console.error('[shipyard-gateway] config must export `candidates`')
    process.exit(1)
  }

  const keyStore: ApiKeyStore | undefined =
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
      ? new SupabaseApiKeyStore({
          url: process.env.SUPABASE_URL,
          key: process.env.SUPABASE_SERVICE_KEY,
          table: process.env.SUPABASE_API_KEYS_TABLE,
        })
      : undefined
  if (keyStore && !config.keyStore) config.keyStore = keyStore
  const portArg = arg('--port')
  if (portArg) config.port = Number(portArg)

  // Auto-wire operator telemetry from the environment, so every app and user
  // hitting this gateway is captured centrally — no per-app code. A config that
  // already sets `telemetry` wins; otherwise an operator URL turns it on.
  let reporter: TelemetryReporter | undefined
  const operatorUrl = process.env.SHIPYARD_OPERATOR_URL
  if (operatorUrl && !config.telemetry) {
    reporter = createTelemetryReporter({
      url: operatorUrl,
      token: process.env.SHIPYARD_TELEMETRY_TOKEN,
      source: process.env.SHIPYARD_GATEWAY_SOURCE ?? 'gateway',
      onError: (err) => console.warn('[shipyard-gateway] telemetry delivery failed:', err),
    })
    config.telemetry = reporter
  }

  const { port, close } = startGateway(config)
  console.log(`shipyard-gateway listening on http://localhost:${port}`)
  console.log(`  candidates: ${config.candidates.map((c) => c.id).join(', ')}`)
  if (reporter) {
    console.log(
      `  telemetry → ${operatorUrl} (source: ${process.env.SHIPYARD_GATEWAY_SOURCE ?? 'gateway'})`,
    )
  }

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received — shutting down`)
    // Flush queued telemetry before the process exits so the tail isn't lost.
    void Promise.resolve(reporter?.close())
      .then(() => close())
      .then(() => process.exit(0))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[shipyard-gateway] failed to start:', err)
  process.exit(1)
})

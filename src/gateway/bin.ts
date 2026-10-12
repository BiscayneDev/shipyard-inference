#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startGateway } from './serve.js'
import type { GatewayConfig } from './config.js'
import { createTelemetryReporter, type TelemetryReporter } from '../operator/reporter.js'
import { SupabaseApiKeyStore, type ApiKeyStore } from './keys.js'
import {
  GATEWAY_LABEL,
  OLLAMA_LABEL,
  installService,
  serviceStatus,
  uninstallService,
  healthCheck,
} from './service.js'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
function has(name: string): boolean {
  return process.argv.includes(name)
}

async function main(): Promise<void> {
  // Appliance ops subcommand: `service install|uninstall|status`.
  const serviceIdx = process.argv.indexOf('service')
  if (serviceIdx !== -1) {
    const op = process.argv[serviceIdx + 1]
    if (op === 'install') return serviceInstall()
    if (op === 'uninstall') return serviceUninstall()
    if (op === 'status') return serviceStatusCmd()
    console.error('Usage: shipyard-gateway service <install|uninstall|status> [--port <n>] [--config <path>] [--with-ollama]')
    process.exit(1)
  }

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

// ---------------------------------------------------------------------------
// Appliance ops handlers (service install|uninstall|status).
// ---------------------------------------------------------------------------

/** Resolve the repo root (where dist/ and local.gateway.config.mjs live). */
function serviceRepoDir(): string {
  // When run as `node dist/gateway/bin.js`, the repo root is two dirs up.
  const fromDist = resolve(import.meta.dirname, '..', '..')
  return existsSync(resolve(fromDist, 'local.gateway.config.mjs')) ? fromDist : process.cwd()
}

function serviceInstall(): void {
  const repoDir = serviceRepoDir()
  const programPath = resolve(repoDir, 'dist', 'gateway', 'bin.js')
  const configArg = arg('--config')
  const configPath = configArg
    ? resolve(configArg)
    : resolve(repoDir, 'local.gateway.config.mjs')
  const nodeBin = process.env.SHIPYARD_NODE_BIN ?? process.execPath
  try {
    const result = installService({
      nodeBin,
      programPath,
      configPath,
      port: Number(arg('--port') ?? 8787),
      repoDir,
      withOllama: has('--with-ollama'),
    })
    console.log(`✓ gateway LaunchAgent installed → ${result.gatewayPlist}`)
    if (result.ollamaPlist) console.log(`✓ ollama LaunchAgent installed → ${result.ollamaPlist}`)
    console.log(`  logs: ${result.logDir}`)
    console.log('\n  The gateway survives reboots and crash-restarts (KeepAlive).')
    console.log('  It is NOT yet serving a request — this is launchd wiring only.')
    if (!healthCheck(Number(arg('--port') ?? 8787))) {
      console.log('  Health: gateway not answering yet (normal right after install; give it a second).')
    } else {
      console.log('  Health: gateway is answering on the configured port. ✓')
    }
  } catch (err) {
    console.error(`✗ install failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

function serviceUninstall(): void {
  try {
    const { removed } = uninstallService()
    if (removed.length === 0) {
      console.log('No Shipyard sourced agent found to remove — nothing to do.')
      return
    }
    for (const p of removed) console.log(`✓ removed ${p}`)
  } catch (err) {
    console.error(`✗ uninstall failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

function serviceStatusCmd(): void {
  for (const label of [GATEWAY_LABEL, OLLAMA_LABEL]) {
    const s = serviceStatus(label)
    if (s.loaded) {
      console.log(`✓ ${label}  loaded${s.pid ? `  pid ${s.pid}` : ''}`)
    } else {
      console.log(`– ${label}  not loaded`)
    }
  }
}

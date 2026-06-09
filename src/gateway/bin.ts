#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startGateway } from './serve.js'
import type { GatewayConfig } from './config.js'

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

  const portArg = arg('--port')
  if (portArg) config.port = Number(portArg)

  const { port, close } = startGateway(config)
  console.log(`shipyard-gateway listening on http://localhost:${port}`)
  console.log(`  candidates: ${config.candidates.map((c) => c.id).join(', ')}`)

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received — shutting down`)
    void close().then(() => process.exit(0))
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[shipyard-gateway] failed to start:', err)
  process.exit(1)
})

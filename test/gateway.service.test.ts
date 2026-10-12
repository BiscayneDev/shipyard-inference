import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GATEWAY_LABEL,
  OLLAMA_LABEL,
  gatewayPlist,
  ollamaPlist,
  plistPath,
  launchAgentDir,
  gatewayLogDir,
} from '../src/gateway/service.js'

const base = {
  nodeBin: '/opt/homebrew/bin/node',
  programPath: '/Users/halseyhuth/projects/shipyard-inference/dist/gateway/bin.js',
  configPath: '/Users/halseyhuth/projects/shipyard-inference/local.gateway.config.mjs',
  port: 8787,
  workingDir: '/Users/halseyhuth/projects/shipyard-inference',
  logDir: '/Users/halseyhuth/.shipyard/logs',
}

test('gateway plist is well-formed XML and declares Survive semantics', () => {
  const pl = gatewayPlist({ ...base, label: GATEWAY_LABEL })
  assert.ok(pl.includes('<plist version="1.0">'))
  assert.ok(pl.includes('<!DOCTYPE plist'))
  // Label + keep-alive guarantee.
  assert.ok(pl.includes(`<string>${GATEWAY_LABEL}</string>`))
  assert.ok(pl.includes('<key>RunAtLoad</key><true/>'))
  assert.ok(pl.includes('<key>KeepAlive</key><true/>'))
  // ProgramArguments run the real command with config + port.
  assert.ok(pl.includes(`<string>${base.nodeBin}</string>`))
  assert.ok(pl.includes(`<string>${base.programPath}</string>`))
  assert.ok(pl.includes('--config'))
  assert.ok(pl.includes(`<string>${base.configPath}</string>`))
  assert.ok(pl.includes('--port'))
  assert.ok(pl.includes('<string>8787</string>'))
  // Working dir + log paths.
  assert.ok(pl.includes(`<string>${base.workingDir}</string>`))
  assert.ok(pl.includes('<key>StandardOutPath</key>'))
  assert.ok(pl.includes('<key>StandardErrorPath</key>'))
  assert.ok(pl.includes('gateway.stdout.log'))
  // Default PATH env is always present.
  assert.ok(pl.includes('<key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>'))
})

test('gateway plist threads extra environment (e.g. x402 billing env)', () => {
  const pl = gatewayPlist({
    ...base,
    label: GATEWAY_LABEL,
    env: { SHIPYARD_X402_SCHEME: 'upto', SHIPYARD_PRICE_USDC: '0.10' },
  })
  assert.ok(pl.includes('<key>SHIPYARD_X402_SCHEME</key><string>upto</string>'))
  assert.ok(pl.includes('<key>SHIPYARD_PRICE_USDC</key><string>0.10</string>'))
})

test('gateway plist XML-escapes special characters', () => {
  const pl = gatewayPlist({ ...base, label: GATEWAY_LABEL, configPath: '/path/with & <spaces>.mjs' })
  assert.ok(pl.includes('&amp;'))
  assert.ok(pl.includes('&lt;'))
  assert.ok(!pl.includes('/path/with & <spaces>.mjs'))
})

test('ollama plist keeps local models up with a long-lived serve', () => {
  const pl = ollamaPlist({
    ollamaBin: '/opt/homebrew/bin/ollama',
    logDir: base.logDir,
  })
  assert.ok(pl.includes(`<string>${OLLAMA_LABEL}</string>`))
  assert.ok(pl.includes('<key>RunAtLoad</key><true/>'))
  assert.ok(pl.includes('<key>KeepAlive</key><true/>'))
  assert.ok(pl.includes('<string>serve</string>'))
  assert.ok(pl.includes('ollama.stdout.log'))
})

test('plist paths resolve under the macOS LaunchAgents home', () => {
  assert.ok(plistPath(GATEWAY_LABEL).endsWith(`Library/LaunchAgents/${GATEWAY_LABEL}.plist`))
  assert.ok(plistPath(OLLAMA_LABEL).endsWith(`Library/LaunchAgents/${OLLAMA_LABEL}.plist`))
  assert.ok(launchAgentDir().endsWith('Library/LaunchAgents'))
  assert.ok(gatewayLogDir().endsWith('.shipyard/logs'))
})

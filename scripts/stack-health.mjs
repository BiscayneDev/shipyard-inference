#!/usr/bin/env node
// Stack health for the local Shipyard Inference demo — one command, whole
// table. Run this BEFORE any e2e test; a dead service explains every
// "mystery hang" up front.
//
//   node scripts/stack-health.mjs
//
// Services checked (all optional — absent ones report DOWN):
//   validator  solana-test-validator on :8899 (with the payment-channels program)
//   ollama     local model server on :11434 (llama3.2:3b)
//   gateway    shipyard-gateway on :8787
//   portal     chat portal on :8788 (incl. x402 upto billing status)
const CHECKS = [
  {
    name: 'validator',
    async run() {
      const res = await fetch('http://127.0.0.1:8899', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}',
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) throw new Error(`rpc ${res.status}`)
      const prog = await fetch('http://127.0.0.1:8899', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["CHNLxYvVA28MJP9PrFuDXccuoGXAx7jBacfLEkahyGsX",{"encoding":"base64"}]}',
        signal: AbortSignal.timeout(3000),
      }).then((r) => r.json())
      if (prog.result?.value?.data?.[0]) return 'up · payment-channels program loaded'
      return 'up · ⚠ payment-channels program MISSING (restart validator with --bpf-program)'
    },
  },
  {
    name: 'ollama',
    async run() {
      const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error(`http ${res.status}`)
      const models = (await res.json()).models?.map((m) => m.name) ?? []
      return models.length ? `up · ${models.join(', ')}` : 'up · no models pulled'
    },
  },
  {
    name: 'gateway',
    async run() {
      const res = await fetch('http://127.0.0.1:8787/v1/models', {
        headers: { authorization: 'Bearer dev-key' },
        signal: AbortSignal.timeout(3000),
      })
      if (res.status === 401) throw new Error('up · auth on (dev-key rejected — different key set)')
      if (!res.ok) throw new Error(`http ${res.status}`)
      const list = await res.json()
      return `up · ${list.data?.length ?? 0} models`
    },
  },
  {
    name: 'portal',
    async run() {
      const res = await fetch('http://localhost:8788/', { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error(`http ${res.status}`)
      const cfg = await fetch('http://localhost:8788/api/upto-config', { signal: AbortSignal.timeout(3000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      return cfg?.enabled
        ? `up · x402 upto billing ON (ceiling $${cfg.ceilingUsd})`
        : 'up · x402 upto billing OFF'
    },
  },
]

let failures = 0
for (const check of CHECKS) {
  const line = await check
    .run()
    .catch((err) => {
      failures++
      return `DOWN — ${err.message ?? err}`
    })
    .then((msg) => msg)
  const mark = line.startsWith('DOWN') ? '✗' : '✓'
  console.log(`${mark} ${check.name.padEnd(10)} ${line}`)
}
process.exit(failures > 0 ? 1 : 0)

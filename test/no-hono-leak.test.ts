import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('../src', import.meta.url))

function tsFilesExcludingGateway(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'gateway') continue // gateway is the only place hono is allowed
      out.push(...tsFilesExcludingGateway(full))
    } else if (entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

test('hono is never imported outside src/gateway (keeps `import { Router }` server-free)', () => {
  const offenders = tsFilesExcludingGateway(srcDir).filter((file) =>
    /from\s+['"]hono/.test(readFileSync(file, 'utf8')),
  )
  assert.deepEqual(offenders, [], `hono imported outside the gateway: ${offenders.join(', ')}`)
})

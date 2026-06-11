import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('../src', import.meta.url))

// The server entrypoints — gateway and the operator console — are the only
// places hono is allowed. Root (`import { Router }`) must stay server-free, so
// the operator's root-exported pieces (reporter/hub/store/types) never touch it.
const SERVER_DIRS = new Set(['gateway', 'operator'])

function tsFilesExcludingServers(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (SERVER_DIRS.has(entry)) continue
      out.push(...tsFilesExcludingServers(full))
    } else if (entry.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

test('hono is never imported outside the server dirs (keeps `import { Router }` server-free)', () => {
  const offenders = tsFilesExcludingServers(srcDir).filter((file) =>
    /from\s+['"]hono/.test(readFileSync(file, 'utf8')),
  )
  assert.deepEqual(offenders, [], `hono imported outside a server dir: ${offenders.join(', ')}`)
})

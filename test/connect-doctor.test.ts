import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runDoctor } from '../src/connect/doctor.js'

test('runDoctor composes probes and prints the report', async () => {
  const printed: string[] = []
  const out = await runDoctor({
    write: (s: string) => printed.push(s),
    baseUrl: 'http://127.0.0.1:11434',
    fetchImpl: (async (url: string) => {
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3.2:3b' }] }))
      }
      throw new Error('unexpected ' + url)
    }) as unknown as typeof fetch,
    execSync: (cmd: string) => (cmd.includes('hw.memsize') ? '8589934592' : 'Apple M2'),
  })
  assert.ok(out.includes('Apple M2'))
  const text = printed.join('')
  assert.ok(text.includes('Shipyard appliance advisor'))
  assert.ok(text.includes('llama3.2:3b'))
})

test('runDoctor never throws even when everything is down', async () => {
  const out = await runDoctor({
    write: () => {},
    baseUrl: 'http://127.0.0.1:11434',
    fetchImpl: (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch,
    execSync: () => {
      throw new Error('no sysctl')
    },
  })
  assert.ok(out.includes('Ollama is not running') || out.includes('fallback'))
})

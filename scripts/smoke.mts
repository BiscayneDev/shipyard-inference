// Local smoke test for the combined Vercel app — exercises app.fetch() directly.
//   npx tsx scripts/smoke.mts
import app from '../app.js'

function ok(label: string, cond: boolean, extra = ''): void {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) process.exitCode = 1
}

// 1. health
const health = await app.fetch(new Request('http://x/healthz'))
const healthBody = await health.json()
ok('GET /healthz', health.status === 200 && healthBody.status === 'ok', JSON.stringify(healthBody))

// 2. models (demo mode is open — no auth)
const models = await app.fetch(new Request('http://x/v1/models'))
const modelsBody = await models.json()
ok('GET /v1/models', models.status === 200 && Array.isArray(modelsBody.data), `${modelsBody.data?.length} models`)

// 3. streaming chat completion (demo provider)
const chat = await app.fetch(
  new Request('http://x/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'auto', stream: true, messages: [{ role: 'user', content: 'hello shipyard' }] }),
  }),
)
let chunks = 0
let sawContent = false
if (chat.body) {
  const reader = chat.body.getReader()
  const dec = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const text = dec.decode(value)
    for (const line of text.split('\n')) {
      if (line.startsWith('data:') && !line.includes('[DONE]')) {
        chunks++
        try {
          const j = JSON.parse(line.slice(5).trim())
          if (j.choices?.[0]?.delta?.content) sawContent = true
        } catch { /* trailer / non-json */ }
      }
    }
  }
}
ok('POST /v1/chat/completions (stream)', chat.status === 200 && chunks > 0 && sawContent, `${chunks} chunks`)

// Let the fire-and-forget telemetry flush settle (on Vercel this is awaited via
// waitUntil; locally there's no request context, so it's best-effort).
await new Promise((r) => setTimeout(r, 200))

// 4. dashboard API (open when no operator token configured)
const meta = await app.fetch(new Request('http://x/api/meta'))
const metaBody = await meta.json()
ok('GET /api/meta', meta.status === 200 && Array.isArray(metaBody.windows), JSON.stringify(metaBody))

const overview = await app.fetch(new Request('http://x/api/overview?window=1h'))
const ov = await overview.json()
ok('GET /api/overview', overview.status === 200 && typeof ov.requests === 'number', `${ov.requests} requests seen`)

console.log('\nsmoke complete.')

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG } from '../src/catalog/models.ts'
import { DEFAULT_PRICING } from '../src/router/pricing.ts'
import { ladderForHardware } from '../src/connect/hardware.ts'
import { createOperatorConsole, TelemetryHub } from '../src/operator/index.ts'

test('catalog has at least one local and one cloud entry', () => {
  assert.ok(CATALOG.some((m) => m.localAvailable))
  assert.ok(CATALOG.some((m) => !m.localAvailable))
})

test('no orphan catalog rows — every cloud slug is priced in DEFAULT_PRICING', () => {
  for (const entry of CATALOG.filter((m) => !m.localAvailable)) {
    const meta = DEFAULT_PRICING[entry.slug]
    assert.ok(meta, `catalog row ${entry.slug} has no DEFAULT_PRICING entry (orphan)`)
    assert.equal(entry.inputPerMTok, meta.inputCostPerMTok, `input price drift on ${entry.slug}`)
    assert.equal(entry.outputPerMTok, meta.outputCostPerMTok, `output price drift on ${entry.slug}`)
    assert.equal(entry.context, meta.contextWindow, `context drift on ${entry.slug}`)
  }
})

test('no orphan catalog rows — every local slug exists in the hardware ladder', () => {
  // A very large profile surfaces the full hardware ladder CATALOG.
  const full = ladderForHardware({ totalRamGb: 256, chip: 'test', platform: 'darwin' })
  const ladderSlugs = new Set(full.models.map((m) => m.model))
  for (const entry of CATALOG.filter((m) => m.localAvailable)) {
    assert.ok(ladderSlugs.has(entry.slug), `catalog row ${entry.slug} is not in the hardware ladder (orphan)`)
  }
})

test('hardwareFit derives from the hardware ladder thresholds', () => {
  const fit8 = new Set(
    ladderForHardware({ totalRamGb: 8, chip: 'Apple M2', platform: 'darwin' }).models.map((m) => m.model),
  )
  const fit32 = new Set(
    ladderForHardware({ totalRamGb: 32, chip: 'Apple M2 Pro', platform: 'darwin' }).models.map((m) => m.model),
  )
  for (const entry of CATALOG.filter((m) => m.localAvailable)) {
    if (fit8.has(entry.slug)) assert.equal(entry.hardwareFit, 'runs-on-8gb', entry.slug)
    else if (fit32.has(entry.slug)) assert.equal(entry.hardwareFit, 'needs-32gb', entry.slug)
    else assert.equal(entry.hardwareFit, 'needs-64gb', entry.slug)
  }
  for (const entry of CATALOG.filter((m) => !m.localAvailable)) {
    assert.equal(entry.hardwareFit, 'cloud-only', entry.slug)
  }
})

test('GET /api/catalog serves the catalog module and /catalog serves the page', async () => {
  const hub = new TelemetryHub({ now: () => Date.now() })
  const app = createOperatorConsole({ hub, operatorTokens: [], ingestTokens: [] })
  const res = await app.request('/api/catalog')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body.models))
  assert.equal(body.models.length, CATALOG.length)
  assert.ok(body.models.every((m: { slug: string; hardwareFit: string }) => m.slug && typeof m.hardwareFit === 'string'))
  const page = await app.request('/catalog')
  assert.equal(page.status, 200)
  assert.match(await page.text(), /catalog\.js/)
})

test('GET /api/catalog stays public even when operator tokens are set', async () => {
  const hub = new TelemetryHub({ now: () => Date.now() })
  const app = createOperatorConsole({ hub, operatorTokens: ['t'], ingestTokens: [] })
  const res = await app.request('/api/catalog') // no Authorization header
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(Array.isArray(body.models))
  // Ungated payload must carry no secrets: static catalog rows only.
  const text = JSON.stringify(body)
  assert.ok(!text.includes('token') && !text.includes('key') && !text.includes('sk-'), 'catalog payload must not leak credentials')
  // Gated endpoints stay gated.
  const gated = await app.request('/api/overview')
  assert.equal(gated.status, 401)
})

test('local entries are free and cloud entries carry both prices', () => {
  for (const entry of CATALOG) {
    if (entry.localAvailable) {
      assert.equal(entry.inputPerMTok, 0)
      assert.equal(entry.outputPerMTok, 0)
    } else {
      assert.ok(Number.isFinite(entry.inputPerMTok) && Number.isFinite(entry.outputPerMTok), entry.slug)
    }
  }
})

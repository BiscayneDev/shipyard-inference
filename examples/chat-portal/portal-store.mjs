// Portal KV store — three tiers, one interface.
//
//  • Supabase (PostgREST) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set —
//    the Vercel tier: no writable disk, shared across invocations.
//  • File-backed .data/ when the FS is writable — local dev, survives restarts.
//  • In-memory as the last resort (read-only FS without Supabase env).
//
// Supabase table (one row per key):
//   portal_store(scope text, key text, value jsonb, updated_at timestamptz, pk(scope,key))
//
// Maps are stored one row per entry (scope=sessions, key=<sessionId>); whole
// arrays use a single row with key 'all'.

import fs from 'node:fs'

const SB = (() => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null
  return {
    base: process.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
  }
})()

// ---- public API ------------------------------------------------------------

const memory = {} // scope -> { key -> json } — fallback + file-tier cache

async function readScope(scope) {
  if (SB) {
    const res = await fetch(`${SB.base}/portal_store?select=key,value&scope=eq.${encodeURIComponent(scope)}`, {
      headers: SB.headers,
    })
    if (!res.ok) throw new Error(`portal_store read ${scope}: ${res.status}`)
    const rows = await res.json()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }
  try {
    return JSON.parse(fs.readFileSync(new URL(`./.data/${scope}.json`, import.meta.url), 'utf8')) ?? {}
  } catch {
    return memory[scope] ?? {}
  }
}

async function writeScope(scope, map) {
  if (SB) {
    const rows = Object.entries(map).map(([key, value]) => ({
      scope,
      key,
      value: JSON.parse(JSON.stringify(value ?? null)), // strip functions (onRefresh hooks etc.)
      updated_at: new Date().toISOString(),
    }))
    if (!rows.length) return
    const res = await fetch(`${SB.base}/portal_store`, { method: 'POST', headers: SB.headers, body: JSON.stringify(rows) })
    if (!res.ok) throw new Error(`portal_store write ${scope}: ${res.status}`)
    return
  }
  try {
    fs.mkdirSync(new URL('./.data/', import.meta.url), { recursive: true })
    fs.writeFileSync(new URL(`./.data/${scope}.json`, import.meta.url), JSON.stringify(map))
  } catch {
    memory[scope] = map // read-only FS: keep serving from memory
  }
}

/** Load a scope's entries as a plain object. */
export async function loadScope(scope) {
  try {
    return await readScope(scope)
  } catch (err) {
    console.warn(`[portal-store] load ${scope} failed:`, err?.message ?? err)
    return memory[scope] ?? {}
  }
}

/** Debounced write-through for a whole scope map. On the Supabase
 * (serverless) tier there is NO debounce: the invocation can freeze the
 * moment the response is sent, killing a pending timer — the OAuth callback
 * would redirect before the session ever reached Supabase. Writes start
 * immediately and are kept alive with @vercel/functions waitUntil. */
const pending = {} // scope -> { map, timer }
export function saveScope(scope, map) {
  if (SB) {
    const p = writeScope(scope, map).catch((e) =>
      console.warn(`[portal-store] save ${scope} failed:`, e?.message ?? e),
    )
    try {
      import('@vercel/functions')
        .then(({ waitUntil }) => waitUntil(p))
        .catch(() => {})
    } catch {}
    return
  }
  clearTimeout(pending[scope]?.timer)
  pending[scope] = {
    map,
    timer: setTimeout(
      () =>
        writeScope(scope, pending[scope]?.map ?? {}).catch((e) =>
          console.warn(`[portal-store] save ${scope} failed:`, e?.message ?? e),
        ),
      250,
    ),
  }
}

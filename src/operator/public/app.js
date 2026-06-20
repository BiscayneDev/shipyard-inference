// Shipyard Inference — hosted control plane (vanilla, no build step).
'use strict'

const TOKEN_KEY = 'shipyard_operator_token'
const WINDOWS = ['15m', '1h', '6h', '24h', '48h']
const WINDOW_MS = { '15m': 9e5, '1h': 36e5, '6h': 216e5, '24h': 864e5, '48h': 1728e5 }
const DIMS = [
  ['model', 'Model'],
  ['provider', 'Provider'],
  ['user', 'User'],
  ['source', 'Deployment'],
]

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  window: '1h',
  source: '',
  dim: 'model',
  meta: { marginPct: 15, treasuryConfigured: false, sources: [] },
}

const $ = (id) => document.getElementById(id)

// ---------- formatting ----------
const fmtInt = (n) => Math.round(n || 0).toLocaleString()
const fmtNum = (n, d = 1) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: d })
function fmtUsd(n) {
  if (n === null || n === undefined) return '—'
  const a = Math.abs(n)
  if (a === 0) return '$0'
  if (a < 1) return '$' + n.toFixed(4)
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const fmtPct = (n) => ((n || 0) * 100).toFixed(1) + '%'
const fmtMs = (n) => (!n ? '0ms' : n < 1000 ? Math.round(n) + 'ms' : (n / 1000).toFixed(2) + 's')
const shortAddr = (a) => (a && a.length > 10 ? a.slice(0, 4) + '…' + a.slice(-4) : a || '—')
function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return Math.floor(s) + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  return Math.floor(s / 3600) + 'h'
}
function explorerUrl(sig, network) {
  return `https://explorer.solana.com/tx/${sig}` + (network === 'devnet' ? '?cluster=devnet' : '')
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ---------- api ----------
async function api(path) {
  const res = await fetch('/api' + path, { headers: { authorization: 'Bearer ' + state.token } })
  if (res.status === 401) {
    lock('Token rejected.')
    throw new Error('unauthorized')
  }
  return res.json()
}

// ---------- token gate ----------
function lock(msg) {
  state.token = ''
  localStorage.removeItem(TOKEN_KEY)
  $('app').classList.add('hidden')
  $('gate').classList.remove('hidden')
  const e = $('gate-error')
  if (msg) { e.textContent = msg; e.classList.remove('hidden') } else e.classList.add('hidden')
}
async function unlock(token) {
  state.token = token
  const res = await fetch('/api/meta', { headers: { authorization: 'Bearer ' + token } })
  if (!res.ok) { lock('Token rejected.'); return }
  localStorage.setItem(TOKEN_KEY, token)
  state.meta = await res.json()
  $('gate').classList.add('hidden')
  $('app').classList.remove('hidden')
  buildControls()
  refresh()
}

// ---------- controls ----------
function buildControls() {
  const seg = $('window-seg')
  seg.innerHTML = WINDOWS.map((w) => `<button data-w="${w}">${w}</button>`).join('')
  seg.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { state.window = b.dataset.w; syncSeg(); refresh() }))

  const dseg = $('dim-seg')
  dseg.innerHTML = DIMS.map(([k, l]) => `<button data-d="${k}">${l}</button>`).join('')
  dseg.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { state.dim = b.dataset.d; syncSeg(); renderBreakdown() }))

  syncSeg()
  renderSources()
}
function syncSeg() {
  $('window-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.w === state.window))
  $('dim-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.d === state.dim))
}
function renderSources() {
  const sel = $('source')
  const opts = ['<option value="">All deployments</option>']
    .concat((state.meta.sources || []).map((s) => `<option value="${esc(s)}">${esc(s)}</option>`))
  sel.innerHTML = opts.join('')
  sel.value = state.source
}

// ---------- charts (inline SVG) ----------
function svgBars(buckets, get, color) {
  const max = Math.max(1, ...buckets.map(get))
  const w = 100 / Math.max(1, buckets.length)
  const bars = buckets.map((b, i) => {
    const h = (get(b) / max) * 38
    return `<rect x="${(i * w).toFixed(2)}" y="${(40 - h).toFixed(2)}" width="${(w * 0.78).toFixed(2)}" height="${h.toFixed(2)}" fill="${color}" rx="0.4"/>`
  })
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" style="width:100%;height:100%">${bars.join('')}</svg>`
}
function svgLines(buckets, series) {
  const max = Math.max(1e-9, ...series.flatMap((s) => buckets.map(s.get)))
  const n = Math.max(1, buckets.length - 1)
  const lines = series.map((s) => {
    const pts = buckets.map((b, i) => `${((i / n) * 100).toFixed(2)},${(40 - (s.get(b) / max) * 38).toFixed(2)}`).join(' ')
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`
  })
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" style="width:100%;height:100%">${lines.join('')}</svg>`
}

// ---------- renderers ----------
function chip(cls, label, value) {
  return `<div class="chip ${cls}"><span class="led"></span><span class="muted">${label}</span><b>${value}</b></div>`
}
function gradeErr(r) { return r < 0.02 ? 'good' : r < 0.05 ? 'warn' : 'bad' }
function gradeLat(ms) { return ms < 3000 ? 'good' : ms < 8000 ? 'warn' : 'bad' }
function gradeFail(r) { return r < 0.02 ? 'good' : r < 0.1 ? 'warn' : 'bad' }

function renderChips(o, billing) {
  const chips = []
  chips.push(chip(gradeErr(o.errorRate), 'error rate', fmtPct(o.errorRate)))
  chips.push(chip(gradeLat(o.latencyP95Ms), 'p95 latency', fmtMs(o.latencyP95Ms)))
  chips.push(chip(o.savingsPct > 0.2 ? 'good' : o.savingsPct > 0 ? 'warn' : '', 'savings', fmtPct(o.savingsPct)))
  chips.push(chip(gradeFail(o.failoverRate), 'failover', fmtPct(o.failoverRate)))
  chips.push(chip(o.cacheHits + o.cacheMisses ? 'good' : '', 'cache hit', fmtPct(o.cacheHitRate)))
  if (billing && billing.stuck > 0) chips.push(chip('bad', 'stuck settlements', fmtInt(billing.stuck)))
  if (billing && billing.treasury) {
    const low = billing.treasury.some((t) => t.usdc !== null && t.usdc < 1)
    const total = billing.treasury.reduce((s, t) => s + (t.usdc || 0), 0)
    chips.push(chip(low ? 'warn' : 'good', 'treasury', fmtUsd(total)))
  }
  $('chips').innerHTML = chips.join('')
}

function kpi(label, value, sub, cls) {
  return `<div class="kpi"><div class="label">${label}</div><div class="value ${cls || ''}">${value}</div>${sub ? `<div class="delta">${sub}</div>` : ''}</div>`
}
function renderKpis(o) {
  const cards = [
    kpi('Usage requests', fmtInt(o.requests), fmtNum(o.rpm, 1) + ' /min'),
    kpi('Token volume', fmtInt(o.inputTokens + o.outputTokens), fmtInt(o.tpm) + ' /min · ' + fmtInt(o.inputTokens) + ' in / ' + fmtInt(o.outputTokens) + ' out'),
    kpi('Actual LLM spend', fmtUsd(o.actualCostUsd), 'real spend'),
    kpi('Savings', fmtUsd(o.savedUsd), fmtPct(o.savingsPct) + ' vs baseline', 'pos'),
    kpi('Billable revenue (modeled)', fmtUsd(o.revenueUsd), state.meta.marginPct + '% margin rule', 'accent'),
    kpi('Gross margin', fmtUsd(o.marginUsd), fmtPct(o.marginPct) + ' of revenue', 'pos'),
    kpi('p95 latency', fmtMs(o.latencyP95Ms), 'p50 ' + fmtMs(o.latencyP50Ms) + ' · p99 ' + fmtMs(o.latencyP99Ms)),
    kpi('Error rate', fmtPct(o.errorRate), fmtInt(o.errors) + ' errors · ' + fmtInt(o.failovers) + ' failover · ' + fmtInt(o.retries) + ' retry'),
    kpi('Tenants', fmtInt(o.users), fmtInt(o.sources) + ' source(s)'),
  ]
  $('kpis').innerHTML = cards.join('')
}

function renderBreakdown() {
  api(`/breakdown?dimension=${state.dim}&window=${state.window}${state.source ? '&source=' + encodeURIComponent(state.source) : ''}`)
    .then((rows) => {
      if (!rows.length) { $('breakdown').innerHTML = '<div class="empty">No requests in this window.</div>'; return }
      const head = ['<th>' + DIMS.find((d) => d[0] === state.dim)[1] + '</th>', '<th>Reqs</th>', '<th>In tok</th>', '<th>Out tok</th>', '<th>Cost</th>', '<th>Saved</th>', '<th>Revenue</th>', '<th>Margin</th>', '<th>Avg lat</th>', '<th>Err</th>']
      const body = rows.map((r) => `<tr>
        <td>${esc(r.key)}</td>
        <td>${fmtInt(r.requests)}</td>
        <td>${fmtInt(r.inputTokens)}</td>
        <td>${fmtInt(r.outputTokens)}</td>
        <td>${fmtUsd(r.actualCostUsd)}</td>
        <td class="pos">${fmtUsd(r.savedUsd)}</td>
        <td>${fmtUsd(r.revenueUsd)}</td>
        <td class="pos">${fmtUsd(r.marginUsd)}</td>
        <td>${fmtMs(r.avgLatencyMs)}</td>
        <td class="${r.errors ? 'neg' : ''}">${fmtInt(r.errors)}</td></tr>`)
      $('breakdown').innerHTML = `<table><thead><tr>${head.join('')}</tr></thead><tbody>${body.join('')}</tbody></table>`
    })
    .catch(() => {})
}

function renderRouting(h) {
  const totalSel = h.selections.reduce((s, x) => s + x.count, 0) || 1
  const top = h.selections.slice(0, 8)
  const statline = `<div class="statline">
    <div><b>${fmtInt(h.autoRequests)}</b><span class="muted">auto</span></div>
    <div><b>${fmtInt(h.pinnedRequests)}</b><span class="muted">pinned</span></div>
    <div><b>${fmtInt(h.failovers)}</b><span class="muted">failovers</span></div>
    <div><b>${fmtInt(h.retries)}</b><span class="muted">retries</span></div>
    <div><b>${fmtInt(h.cacheHits)}</b><span class="muted">cache hits</span></div>
  </div>`
  const provHead = '<tr><th>Provider</th><th>Reqs</th><th>Err</th><th>Fail</th><th>Avail</th><th>Avg lat</th></tr>'
  const provBody = h.providers.length
    ? h.providers.map((p) => `<tr><td>${esc(p.provider)}</td><td>${fmtInt(p.requests)}</td><td class="${p.errors ? 'neg' : ''}">${fmtInt(p.errors)}</td><td>${fmtInt(p.failovers)}</td><td class="${p.availability < 0.98 ? 'neg' : 'pos'}">${fmtPct(p.availability)}</td><td>${fmtMs(p.avgLatencyMs)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">No traffic.</td></tr>'
  const sel = top.map((s) => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:12px">
    <span style="width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.key)}</span>
    <span class="bar-track"><span class="bar" style="width:${((s.count / totalSel) * 100).toFixed(0)}%"></span></span>
    <span class="muted">${fmtInt(s.count)}</span></div>`).join('')
  $('routing').innerHTML = statline +
    `<table>${provHead}${provBody}</table>` +
    (sel ? `<div style="margin-top:12px"><div class="card-sub" style="margin-bottom:6px">Model selection</div>${sel}</div>` : '')
}

function renderBilling(b) {
  $('billing-sub').textContent = `${fmtUsd(b.settledUsd)} settled USDC`
  const statline = `<div class="statline">
    <div><b>${fmtUsd(b.revenueUsd)}</b><span class="muted">revenue</span></div>
    <div><b>${fmtUsd(b.actualCostUsd)}</b><span class="muted">cost</span></div>
    <div><b class="pos" style="color:var(--good)">${fmtUsd(b.marginUsd)}</b><span class="muted">margin</span></div>
    <div><b>${fmtUsd(b.settledUsd)}</b><span class="muted">settled USDC</span></div>
    <div><b class="${b.stuck ? '' : ''}" style="color:${b.stuck ? 'var(--bad)' : 'inherit'}">${fmtInt(b.stuck)}</b><span class="muted">stuck</span></div>
  </div>`
  let treas = ''
  if (b.treasury && b.treasury.length) {
    treas = '<div class="treas">' + b.treasury.map((t) => `<div class="t"><div class="muted">${shortAddr(t.address)} · ${t.network}</div><div class="b">${t.usdc === null ? '—' : fmtUsd(t.usdc) + ' USDC'}</div>${t.error ? `<div class="muted" style="color:var(--bad)">${esc(t.error.slice(0, 40))}</div>` : ''}</div>`).join('') + '</div>'
  } else if (state.meta.treasuryConfigured) {
    treas = '<div class="empty">Treasury configured — awaiting the first balance read…</div>'
  }
  let table
  if (!b.settlements.length) {
    table = '<div class="empty">No settlements reported yet. Connect <span class="mono">reporter.recordSettlement(...)</span> to show billing in the dashboard.</div>'
  } else {
    const head = '<tr><th>When</th><th>Deployment</th><th>User</th><th>Amount</th><th>Status</th><th>Tx</th></tr>'
    const body = b.settlements.map((s) => `<tr>
      <td>${ago(s.at)} ago</td>
      <td>${esc(s.source)}</td>
      <td>${esc(s.userId || '—')}</td>
      <td>${fmtUsd(s.amountUsd)}</td>
      <td><span class="tag ${s.status}">${s.status}</span></td>
      <td>${s.signature ? `<a href="${explorerUrl(s.signature, s.network)}" target="_blank" rel="noopener">${s.signature.slice(0, 6)}…</a>` : '—'}</td></tr>`).join('')
    table = `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`
  }
  $('billing').innerHTML = statline + treas + table
}

function renderFeed(rows) {
  $('feed-sub').textContent = rows.length ? rows.length + ' shown' : ''
  if (!rows.length) { $('feed').innerHTML = '<div class="empty">No usage yet.</div>'; return }
  const head = '<tr><th>When</th><th>Deployment</th><th>Model</th><th>User</th><th>In/Out</th><th>Cost</th><th>Saved</th><th>Lat</th></tr>'
  const body = rows.map((r) => `<tr>
    <td>${ago(r.at)}</td>
    <td>${esc(r.source)}</td>
    <td>${esc(r.model || '—')} ${r.pinned ? '<span class="tag pin">pin</span>' : ''}</td>
    <td>${esc(r.userId || '—')}</td>
    <td>${fmtInt(r.inputTokens)}/${fmtInt(r.outputTokens)}</td>
    <td>${fmtUsd(r.actualCostUsd)}</td>
    <td class="pos">${fmtUsd(r.savedUsd)}</td>
    <td>${fmtMs(r.latencyMs)}</td></tr>`).join('')
  $('feed').innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

function renderErrors(rows) {
  if (!rows.length) { $('errors').innerHTML = '<div class="empty">No errors in this window. 🎉</div>'; return }
  const head = '<tr><th>Message</th><th>Count</th><th>Last</th><th>Where</th></tr>'
  const body = rows.map((e) => `<tr>
    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis">${esc(e.message)}</td>
    <td class="neg">${fmtInt(e.count)}</td>
    <td>${ago(e.lastAt)} ago</td>
    <td class="muted">${esc(e.lastProvider || '')} ${esc(e.lastModel || '')}</td></tr>`).join('')
  $('errors').innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}

// ---------- refresh loop ----------
let refreshing = false
async function refresh() {
  if (!state.token || refreshing) return
  refreshing = true
  const q = `window=${state.window}${state.source ? '&source=' + encodeURIComponent(state.source) : ''}`
  try {
    const [o, ts, routing, billing, feed, errors, meta] = await Promise.all([
      api('/overview?' + q),
      api('/timeseries?' + q + '&buckets=48'),
      api('/routing?' + q),
      api('/billing?' + q),
      api('/feed?limit=60' + (state.source ? '&source=' + encodeURIComponent(state.source) : '')),
      api('/errors?' + q),
      api('/meta'),
    ])
    state.meta = meta
    if ((meta.sources || []).join() !== ($('source').dataset.known || '')) {
      $('source').dataset.known = (meta.sources || []).join()
      renderSources()
    }
    $('sub').textContent = `${fmtNum(o.rpm, 1)} req/min · ${fmtInt(o.sources)} tenant(s) · window ${state.window}`
    $('rpm-sub').textContent = `${fmtInt(o.requests)} requests in view`
    $('cost-sub').textContent = `${fmtUsd(o.actualCostUsd)} actual spend · ${fmtUsd(o.savedUsd)} saved`
    renderChips(o, billing)
    renderKpis(o)
    $('chart-requests').innerHTML = svgBars(ts, (b) => b.requests, 'var(--accent)')
    $('chart-cost').innerHTML = svgLines(ts, [
      { get: (b) => b.actualCostUsd, color: 'var(--accent)' },
      { get: (b) => b.savedUsd, color: 'var(--good)' },
    ])
    renderRouting(routing)
    renderBilling(billing)
    renderFeed(feed)
    renderErrors(errors)
    renderBreakdown()
  } catch (e) {
    // 401 already handled by lock(); ignore transient errors.
  } finally {
    refreshing = false
  }
}

// ---------- wire up ----------
$('gate-form').addEventListener('submit', (e) => { e.preventDefault(); const t = $('token').value.trim(); if (t) unlock(t) })
$('lock').addEventListener('click', () => lock())
$('source').addEventListener('change', (e) => { state.source = e.target.value; refresh() })

setInterval(refresh, 5000)

if (state.token) unlock(state.token)
else lock()

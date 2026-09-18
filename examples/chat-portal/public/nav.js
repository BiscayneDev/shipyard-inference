// Nav rail — the portal's routing owner. Six destinations in three groups:
//   Workspace: Chat, Decisions · Insight: History, Activity, Guardrails
//   Portal: Settings
// Owns view switching (with the gliding hover pill), the collapse rail, and
// the four insight/portal page renderers. Chat + Decisions keep their own
// modules; this module only shows/hides the surfaces.
const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' })[c])
const usd = (n, d = 6) => '$' + (Number(n) || 0).toFixed(d)

const SURFACES = {
  chat: () => document.querySelector('main.chat:not(.dec):not(.page)'),
  decisions: () => $('decisions'),
  history: () => $('page-history'),
  activity: () => $('page-activity'),
  guardrails: () => $('page-guardrails'),
  settings: () => $('page-settings'),
}

const chatMain = SURFACES.chat()
const decMain = SURFACES.decisions()
const glider = document.createElement('div')
glider.className = 'glider'
$('navrail').prepend(glider)

function glideTo(btn) {
  if (!btn) return
  glider.style.top = btn.offsetTop + 'px'
  glider.style.height = btn.offsetHeight + 'px'
}

export function setView(view) {
  for (const b of document.querySelectorAll('.navrail-opt')) {
    b.classList.toggle('active', b.dataset.view === view)
  }
  glideTo(document.querySelector('.navrail-opt.active'))
  for (const [name, get] of Object.entries(SURFACES)) {
    const el = get()
    if (el) el.classList.toggle('hidden', name !== view)
  }
  if (view === 'history') renderHistory()
  if (view === 'activity') renderActivity()
  if (view === 'guardrails') renderGuardrails()
  if (view === 'settings') renderSettings()
  window.dispatchEvent(new CustomEvent('portal:view', { detail: view }))
}

for (const b of document.querySelectorAll('.navrail-opt')) {
  b.addEventListener('click', () => setView(b.dataset.view))
  b.addEventListener('mouseenter', () => glideTo(b))
}
$('navrail').addEventListener('mouseleave', () => glideTo(document.querySelector('.navrail-opt.active')))

const collapseBtn = $('nav-collapse')
if (localStorage.getItem('portal.nav-collapsed') === '1') $('navrail').classList.add('navrail-collapsed')
collapseBtn.addEventListener('click', () => {
  const collapsed = $('navrail').classList.toggle('navrail-collapsed')
  localStorage.setItem('portal.nav-collapsed', collapsed ? '1' : '0')
  collapseBtn.textContent = collapsed ? '»' : '«'
  requestAnimationFrame(() => glideTo(document.querySelector('.navrail-opt.active')))
})
collapseBtn.textContent = $('navrail').classList.contains('navrail-collapsed') ? '»' : '«'
requestAnimationFrame(() => glideTo(document.querySelector('.navrail-opt.active')))

// ---------------------------------------------------------------------------
// Page: History — the user's threads. Click a thread to reopen it in Chat.
// ---------------------------------------------------------------------------
async function renderHistory() {
  const body = $('history-body')
  body.innerHTML = '<div class="page-loading">Loading threads…</div>'
  const { threads } = await fetch('/api/threads').then((r) => r.json()).catch(() => ({ threads: [] }))
  if (!threads?.length) {
    body.innerHTML = '<div class="page-empty">No threads yet — send a message in Chat.</div>'
    return
  }
  body.innerHTML = threads
    .map(
      (t) => `
      <div class="thread-row" data-id="${esc(t.id)}">
        <div class="thread-main">
          <div class="thread-title">${esc(t.title)}</div>
          <div class="thread-preview muted">${esc(t.preview)}</div>
        </div>
        <div class="thread-meta">
          <span class="mono">${t.messages} msgs</span>
          <span class="muted">${timeAgo(t.updatedAt)}</span>
        </div>
        <button class="btn ghost tiny thread-del" data-id="${esc(t.id)}" title="Delete thread">✕</button>
      </div>`,
    )
    .join('')
  for (const row of body.querySelectorAll('.thread-row')) {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.thread-del')) return
      openThread(row.dataset.id)
    })
  }
  for (const del of body.querySelectorAll('.thread-del')) {
    del.addEventListener('click', async (e) => {
      e.stopPropagation()
      await fetch('/api/threads/' + encodeURIComponent(del.dataset.id), { method: 'DELETE' })
      renderHistory()
    })
  }
}

async function openThread(id) {
  const t = await fetch('/api/threads/' + encodeURIComponent(id)).then((r) => r.json()).catch(() => null)
  if (!t?.messages) return
  // Rehydrate into the Chat view's state via its own event contract.
  window.dispatchEvent(new CustomEvent('portal:open-thread', { detail: t }))
  setView('chat')
}

// ---------------------------------------------------------------------------
// Page: Activity — the mempool, promoted to a full page.
// ---------------------------------------------------------------------------
async function renderActivity() {
  const body = $('activity-body')
  body.innerHTML = '<div class="page-loading">Loading activity…</div>'
  const { events } = await fetch('/api/activity?limit=150').then((r) => r.json()).catch(() => ({ events: [] }))
  if (!events?.length) {
    body.innerHTML = '<div class="page-empty">No metered events yet — send a message or ask a decision.</div>'
    return
  }
  const KIND = { reply: '💬', decision: '⩆', settle: '◆', credit: '✦', refund: '↩' }
  body.innerHTML = events
    .map(
      (e) => `
      <div class="event-row">
        <span class="event-icon">${KIND[e.kind] ?? '·'}</span>
        <span class="event-k">${esc(e.kind)}</span>
        <span class="event-detail muted">${esc(eventDetail(e))}</span>
        ${e.costUsd !== undefined ? `<span class="event-amt mono">${usd(e.costUsd)}</span>` : '<span></span>'}
        ${e.savedUsd > 0 ? `<span class="event-saved mono">−${usd(e.savedUsd, 4)}</span>` : '<span></span>'}
        <span class="event-time muted">${timeAgo(e.at)}</span>
      </div>`,
    )
    .join('')
}

function eventDetail(e) {
  if (e.kind === 'reply') return `${e.model ?? 'model'}${e.tokens ? ` · ${e.tokens} tok` : ''}`
  if (e.kind === 'decision') return `${e.questions ?? '?'} typed answers · ${e.model ?? ''}`
  return ''
}

// ---------------------------------------------------------------------------
// Page: Guardrails — the Jev-judged safety/quality feed.
// ---------------------------------------------------------------------------
async function renderGuardrails() {
  const body = $('guardrails-body')
  body.innerHTML = '<div class="page-loading">Loading evaluations…</div>'
  const { live, model, results } = await fetch('/api/guardrails').then((r) => r.json()).catch(() => ({}))
  const banner = live
    ? `<div class="page-note">Judged live by <span class="mono">${esc(model)}</span>.</div>`
    : `<div class="page-note">Backend is the offline stub (set <span class="mono">TYPESAFE_API_KEY</span> for live Jev judging). Results below appear once the gateway's guardrails config reports evaluations.</div>`
  if (!results?.length) {
    body.innerHTML = banner + '<div class="page-empty">No evaluations yet — guardrails score every reply once wired.</div>'
    return
  }
  body.innerHTML =
    banner +
    results
      .map(
        (r) => `
        <div class="guard-row ${r.flagged ? 'flagged' : ''}">
          <span class="guard-flag">${r.flagged ? '⚑' : '✓'}</span>
          <span class="guard-detail">${esc(r.model ?? 'model')} · req ${esc(String(r.requestId ?? '').slice(0, 14))}</span>
          ${r.unsafe !== undefined ? `<span class="mono">unsafe ${(r.unsafe * 100).toFixed(0)}%</span>` : ''}
          ${r.quality !== undefined ? `<span class="mono">quality ${(r.quality * 100).toFixed(0)}%</span>` : ''}
          <span class="muted">${timeAgo(r.at)}</span>
        </div>`,
      )
      .join('')
}

// ---------------------------------------------------------------------------
// Page: Settings — this deployment, at a glance.
// ---------------------------------------------------------------------------
async function renderSettings() {
  const body = $('settings-body')
  body.innerHTML = '<div class="page-loading">Loading…</div>'
  const s = await fetch('/api/settings').then((r) => r.json()).catch(() => null)
  if (!s) {
    body.innerHTML = '<div class="page-empty">Could not load settings.</div>'
    return
  }
  const row = (k, v) => `<div class="setting-row"><span class="setting-k">${esc(k)}</span><span class="setting-v mono">${esc(String(v))}</span></div>`
  body.innerHTML = `
    <div class="setting-card">
      <div class="setting-title">Portal</div>
      ${row('Mode', s.portal.mode)}
      ${row('Production available', s.portal.productionAvailable ? 'yes' : 'no')}
      ${row('Margin', s.portal.marginPct + '%')}
      ${row('Baseline model', s.portal.baselineModel)}
      ${row('Per-message ceiling', s.portal.uptoCeilingUsd !== undefined ? '$' + s.portal.uptoCeilingUsd : '—')}
    </div>
    <div class="setting-card">
      <div class="setting-title">Decisions</div>
      ${row('Backend', s.decisions.live ? 'TypeSafe Jev (live)' : 'offline stub')}
      ${row('Model', s.decisions.model)}
      ${row('Input price', '$' + s.decisions.inputPerMTok + ' / MTok (output free)')}
    </div>
    <div class="setting-card">
      <div class="setting-title">Guardrails</div>
      ${row('Backend', s.guardrails.backend)}
    </div>`
}

// ---------------------------------------------------------------------------
function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return s + 's ago'
  const m = Math.round(s / 60)
  if (m < 60) return m + 'm ago'
  const h = Math.round(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.round(h / 24) + 'd ago'
}

for (const [id, fn] of [
  ['history-refresh', renderHistory],
  ['activity-refresh', renderActivity],
  ['guardrails-refresh', renderGuardrails],
]) {
  $(id)?.addEventListener('click', fn)
}

console.info('[portal] nav rail ready — 6 destinations')

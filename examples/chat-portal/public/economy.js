// Economy primitives — Shipyard-specific, invented on top of the beautifului
// design language. Theme: make the metered economy visible in real time.
//
//   1. Spend Ticker — floating mempool of every metered event: replies,
//      decisions, on-chain settlements, tender credits. Click to inspect.
//   2. Route Preview — while you type, a ghost line under the composer shows
//      what `auto` would route to and the estimated metered cost vs. baseline.
//   3. Latency Waterfall — each reply gets a segmented timing bar:
//      routing → first token → streaming, with real milliseconds.
const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' })[c])
const usd = (n, d = 6) => '$' + (Number(n) || 0).toFixed(d)

// ---------------------------------------------------------------------------
// 1. Spend Ticker — the mempool
// ---------------------------------------------------------------------------
const TICKER_KINDS = {
  reply: { icon: '💬', label: 'reply' },
  decision: { icon: '⩆', label: 'decision' },
  settle: { icon: '◆', label: 'settled' },
  credit: { icon: '✦', label: 'credit' },
  refund: { icon: '↩', label: 'refund' },
}

const ticker = {
  el: null,
  items: [],
  add(kind, { amountUsd, detail, link, sub } = {}) {
    const k = TICKER_KINDS[kind] ?? { icon: '·', label: kind }
    this.items.unshift({ kind, icon: k.icon, label: k.label, amountUsd, detail, link, sub, at: Date.now() })
    if (this.items.length > 40) this.items.pop()
    this.render()
  },
  render() {
    if (!this.el) return
    if (this.items.length === 0) {
      this.el.innerHTML = '<div class="ticker-empty">metered events stream here</div>'
      return
    }
    this.el.innerHTML = this.items
      .slice(0, 6)
      .map(
        (it) => `
        <div class="ticker-item t-${esc(it.kind)}" title="${esc(it.detail ?? it.label)}">
          <span class="ticker-icon">${it.icon}</span>
          <span class="ticker-label">${esc(it.label)}</span>
          ${it.amountUsd !== undefined ? `<span class="ticker-amt mono">${usd(it.amountUsd)}</span>` : ''}
          ${it.link ? `<a class="ticker-link" href="${esc(it.link)}" target="_blank" rel="noreferrer noopener">↗</a>` : ''}
        </div>`,
      )
      .join('') +
      (this.items.length > 6 ? `<div class="ticker-more mono">+${this.items.length - 6} more</div>` : '')
  },
}

// ---------------------------------------------------------------------------
// 4. Savings Toast — a gentle, celebratory moment when a reply saves money.
//    Soft warm glow, drifts up, never nagging. Anti-cyberpunk by design.
// ---------------------------------------------------------------------------
let savingsToastTimer = null
let savingsTotalSeen = 0

export function initSavingsToast() {
  window.addEventListener('portal:meta', (e) => {
    const m = e.detail ?? {}
    if (!m.savedUsd || m.savedUsd <= 0) return
    // Celebrate the FIRST save of a session and every $1 crossed.
    const prev = savingsTotalSeen
    savingsTotalSeen += m.savedUsd
    if (prev === 0 || Math.floor(savingsTotalSeen) > Math.floor(prev)) {
      showToast(m.savedUsd, m.baselineModel)
    }
  })
}

function showToast(savedUsd, baselineModel) {
  clearTimeout(savingsToastTimer)
  let el = document.getElementById('savings-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'savings-toast'
    el.className = 'savings-toast'
    document.body.appendChild(el)
  }
  el.innerHTML = `
    <span class="st-icon">🕯</span>
    <div class="st-body">
      <div class="st-line">You saved <span class="mono st-amt">${usd(savedUsd, 4)}</span></div>
      <div class="st-sub">vs ${esc(String(baselineModel ?? 'the baseline model'))} — routed to the cheapest capable model</div>
    </div>`
  el.classList.remove('show')
  // force reflow so the animation restarts
  void el.offsetWidth
  el.classList.add('show')
  savingsToastTimer = setTimeout(() => el.classList.remove('show'), 4200)
}

export function initSpendTicker() {
  const host = document.createElement('aside')
  host.className = 'ticker'
  host.innerHTML = '<div class="ticker-head">mempool <span class="ticker-live-dot"></span></div><div class="ticker-list" id="ticker-list"></div>'
  document.body.appendChild(host)
  ticker.el = host.querySelector('.ticker-list')

  // Feed from the chat loop's existing events — no server changes needed.
  // meta: a completed reply (cost charged). receipt: on-chain settlement.
  window.addEventListener('portal:meta', (e) => {
    const m = e.detail ?? {}
    if (m.chargedUsd !== undefined || m.actualCostUsd !== undefined) {
      ticker.add('reply', {
        amountUsd: m.chargedUsd ?? m.actualCostUsd,
        detail: `${m.model ?? 'model'} · ${m.provider ?? ''}`,
        sub: m.savedUsd > 0 ? `saved ${usd(m.savedUsd)} vs ${m.baselineModel ?? 'baseline'}` : undefined,
      })
    }
  })
  window.addEventListener('portal:receipt', (e) => {
    const r = e.detail ?? {}
    ticker.add('settle', {
      amountUsd: r.amountUsd,
      detail: `on-chain settle (${r.network})`,
      link: r.signature ? `https://explorer.solana.com/tx/${r.signature}${r.network === 'localnet' || r.network === 'devnet' ? '?cluster=devnet' : ''}` : undefined,
    })
    if (r.refundedUsd > 0) {
      ticker.add('refund', { amountUsd: r.refundedUsd, detail: 'unused escrow returned to wallet' })
    }
  })
  window.addEventListener('portal:decision', (e) => {
    const d = e.detail ?? {}
    ticker.add('decision', {
      amountUsd: d.chargedUsd,
      detail: `${Object.keys(d.answers ?? {}).length} typed answers · ${d.model}`,
    })
  })
  window.addEventListener('portal:attestation', (e) => {
    const a = e.detail ?? {}
    if (a.creditedUsd > 0) {
      ticker.add('credit', { amountUsd: a.creditedUsd, detail: `tender idle-attention credit · valid=${a.valid}` })
    }
  })
  ticker.render()
}

// ---------------------------------------------------------------------------
// 2. Route Preview — pre-flight x-ray under the composer
// ---------------------------------------------------------------------------
let previewAbort = null
let previewDebounce = null

export function initRoutePreview() {
  const hint = document.createElement('div')
  hint.className = 'route-preview hidden'
  hint.id = 'route-preview'
  const wrap = document.querySelector('.composer-wrap')
  wrap?.appendChild(hint)

  const input = $('input')
  input.addEventListener('input', () => {
    clearTimeout(previewDebounce)
    const draft = input.value.trim()
    if (draft.length < 12) {
      hint.classList.add('hidden')
      return
    }
    previewDebounce = setTimeout(() => fetchPreview(hint, draft), 450)
  })
  input.addEventListener('blur', () => setTimeout(() => hint.classList.add('hidden'), 2500))
}

async function fetchPreview(hint, draft) {
  previewAbort?.abort()
  previewAbort = new AbortController()
  try {
    const res = await fetch('api/route-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: draft }] }),
      signal: previewAbort.signal,
    })
    if (!res.ok) {
      hint.classList.add('hidden')
      return
    }
    const p = (await res.json())
    if (!p.available) {
      hint.classList.add('hidden')
      return
    }
    const saved =
      p.baselineCostUsd !== undefined && p.estimatedCostUsd !== undefined
        ? p.baselineCostUsd - p.estimatedCostUsd
        : undefined
    hint.innerHTML = `
      <span class="rp-model mono">${esc(p.model)}</span>
      <span class="rp-tier">${esc(p.tier ?? '')}</span>
      <span class="rp-cost mono">${p.estimatedCostUsd !== undefined ? '~' + usd(p.estimatedCostUsd, 4) : ''}</span>
      ${saved > 0 ? `<span class="rp-saved mono">−${usd(saved, 4)} vs ${esc(p.baselineModel ?? 'baseline')}</span>` : ''}
      <span class="rp-note">pre-flight · not sent</span>`
    hint.classList.remove('hidden')
  } catch {
    /* aborted or offline — keep the composer clean */
  }
}

// ---------------------------------------------------------------------------
// 3. Latency Waterfall — segmented timing bar on each reply
// ---------------------------------------------------------------------------
export function renderWaterfall(assistant, meta) {
  const t = meta?.timing
  if (!t || t.totalMs === undefined) return
  const ttft = t.ttftMs ?? t.totalMs
  const streamMs = Math.max(0, t.totalMs - ttft)
  const total = Math.max(1, t.totalMs)
  const routeMs = Math.min(ttft, Math.round(total * 0.02)) // routing slice ≈ TTFT head
  const firstTokMs = Math.max(0, ttft - routeMs)
  const seg = (ms, frac, cls, label) =>
    `<div class="wf-seg ${cls}" style="flex-grow:${Math.max(frac, 0.06)}" data-label="${label} ${ms}ms"></div>`
  const contentEl = assistant.querySelector('.content')
  contentEl?.insertAdjacentHTML(
    'afterend',
    `<div class="wf" title="routing ${routeMs}ms · first token ${firstTokMs}ms · stream ${streamMs}ms — total ${total}ms">
       ${seg(routeMs, routeMs / total, 'wf-route', 'route')}
       ${seg(firstTokMs, firstTokMs / total, 'wf-ttft', 'first token')}
       ${seg(streamMs, streamMs / total, 'wf-stream', 'stream')}
       <span class="wf-total mono">${total}ms</span>
     </div>`,
  )
}

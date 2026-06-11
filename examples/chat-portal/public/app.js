// Chat portal client — talks to the portal server's /api/* endpoints, streams
// replies over SSE, and keeps the wallet + savings panels live.
const $ = (id) => document.getElementById(id)
const fmt = (n, d = 6) => '$' + (Number(n) || 0).toFixed(d)

const state = {
  sessionId: localStorage.getItem('portal.session') || null,
  messages: [], // {role, content}
  baselineModel: 'baseline',
  baselineTotal: 0,
  sending: false,
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
init()
async function init() {
  await loadModels()
  if (state.sessionId) await refreshWallet()

  $('connect').addEventListener('click', connectWallet)
  $('composer').addEventListener('submit', onSubmit)
  $('new-chat').addEventListener('click', resetChat)
  const ta = $('input')
  ta.addEventListener('input', () => autoGrow(ta))
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e) }
  })
}

async function loadModels() {
  try {
    const { models, baselineModel, mode } = await (await fetch('/api/models')).json()
    state.baselineModel = baselineModel
    $('baseline-name').textContent = baselineModel
    setModeBadge(mode)
    const sel = $('model')
    sel.innerHTML = ''
    for (const m of models) {
      const opt = document.createElement('option')
      opt.value = m.id
      opt.textContent = m.tier === 'auto' ? m.label : `${m.label} · ${m.provider}`
      sel.appendChild(opt)
    }
  } catch {
    $('model').innerHTML = '<option value="auto">Auto — cheapest capable</option>'
  }
}

function setModeBadge(mode) {
  const el = $('mode-badge')
  if (!el || !mode) return
  const label = { demo: 'demo', usepod: 'usepod', x402: 'x402' }[mode] ?? mode
  const tip = {
    demo: 'Built-in mock model — no real inference is billed.',
    usepod: 'Wallet-funded inference — prepaid USDC via UsePod, no API key.',
    x402: 'Wallet-funded inference — per-request USDC via x402/Paybox, no API key.',
  }[mode] ?? ''
  el.textContent = label
  el.title = tip
  el.className = `mode-badge ${mode}`
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
async function connectWallet() {
  const res = await fetch('/api/wallet/connect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: state.sessionId }),
  })
  const w = await res.json()
  state.sessionId = w.sessionId
  localStorage.setItem('portal.session', w.sessionId)
  applyWallet(w)
}

async function refreshWallet() {
  try {
    const w = await (await fetch(`/api/wallet/${state.sessionId}`)).json()
    if (w.error) { state.sessionId = null; localStorage.removeItem('portal.session'); return }
    applyWallet(w)
  } catch { /* offline-ok */ }
}

function applyWallet(w) {
  $('connect').classList.add('hidden')
  $('wallet-card').classList.remove('hidden')
  $('addr').textContent = w.address
  $('addr').title = w.address
  $('balance').textContent = fmt(w.balanceUsd)
  $('pending').textContent = fmt(w.pendingUsd)
  $('mode-pill').textContent = w.mode
  $('spent-total').textContent = fmt(w.spentUsd)
  $('saved-total').textContent = fmt(w.savedUsd)
  $('msg-total').textContent = w.messages
  // baselineTotal is tracked client-side (spent + saved ≈ what direct would cost).
  const baseline = (w.spentUsd || 0) + (w.savedUsd || 0)
  $('baseline-total').textContent = fmt(baseline, 2)
  $('spent-total').textContent = fmt(w.spentUsd, 2)
  const pct = baseline > 0 ? Math.round(((w.savedUsd || 0) / baseline) * 100) : 0
  $('saved-pct').textContent = pct
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
function resetChat() {
  // Session (and thus wallet + savings) lives in localStorage, so a reload
  // gives a clean thread while keeping the connected wallet.
  location.reload()
}

async function onSubmit(e) {
  e.preventDefault()
  if (state.sending) return
  const ta = $('input')
  const text = ta.value.trim()
  if (!text) return

  $('empty')?.remove()
  document.querySelector('.thread .empty')?.remove()

  ta.value = ''
  autoGrow(ta)
  state.messages.push({ role: 'user', content: text })
  renderMessage('user', text)

  const assistant = renderMessage('assistant', '')
  const contentEl = assistant.querySelector('.content')
  contentEl.innerHTML = '<span class="cursor">▍</span>'

  state.sending = true
  setSending(true)

  let acc = ''
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages,
        model: $('model').value,
        sessionId: state.sessionId,
      }),
    })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    await readSSE(res.body, async (evt, data) => {
      if (evt === 'delta') {
        acc += JSON.parse(data).text
        contentEl.textContent = acc
        contentEl.insertAdjacentHTML('beforeend', '<span class="cursor">▍</span>')
        scrollDown()
      } else if (evt === 'meta') {
        contentEl.textContent = acc
        const meta = JSON.parse(data)
        renderChips(assistant, meta)
        if (meta.wallet) applyWallet(meta.wallet)
        await settle(assistant)
      } else if (evt === 'error') {
        contentEl.textContent = acc
        renderError(assistant, JSON.parse(data).message)
      }
    })

    if (acc) state.messages.push({ role: 'assistant', content: acc })
  } catch (err) {
    contentEl.textContent = acc
    renderError(assistant, err.message)
  } finally {
    contentEl.querySelector('.cursor')?.remove()
    state.sending = false
    setSending(false)
  }
}

async function settle(assistant) {
  if (!state.sessionId) return
  try {
    const r = await (await fetch('/api/settle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId }),
    })).json()
    if (r.wallet) applyWallet(r.wallet)
    if (r.settled > 0) {
      const chip = document.createElement('span')
      chip.className = 'chip settle'
      chip.innerHTML = `settled <b>${fmt(r.settled)}</b> USDC`
      assistant.querySelector('.chips')?.appendChild(chip)
    }
  } catch { /* leave metered as pending */ }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderMessage(role, text) {
  const el = document.createElement('div')
  el.className = `msg ${role}`
  el.innerHTML = `
    <div class="avatar">${role === 'user' ? '🧑' : '⚓'}</div>
    <div class="body">
      <div class="role">${role === 'user' ? 'You' : 'Shipyard'}</div>
      <div class="content"></div>
    </div>`
  el.querySelector('.content').textContent = text
  $('thread').appendChild(el)
  scrollDown()
  return el
}

function renderChips(assistant, meta) {
  const body = assistant.querySelector('.body')
  let chips = body.querySelector('.chips')
  if (!chips) { chips = document.createElement('div'); chips.className = 'chips'; body.appendChild(chips) }
  const add = (cls, html) => { const c = document.createElement('span'); c.className = `chip ${cls}`; c.innerHTML = html; chips.appendChild(c) }

  if (meta.model) add('', `<b>${meta.model}</b>${meta.provider ? ' · ' + meta.provider : ''}`)
  if (meta.usage) add('', `${meta.usage.inputTokens}→${meta.usage.outputTokens} tok`)
  if (meta.actualCostUsd !== undefined) add('', `cost <b>${fmt(meta.actualCostUsd)}</b>`)
  if (meta.savedUsd > 0 && meta.baselineCostUsd !== undefined) {
    const pct = Math.round((meta.savedUsd / meta.baselineCostUsd) * 100)
    add('saved', `saved <b>${fmt(meta.savedUsd)}</b> (${pct}%)`)
  }
}

function renderError(assistant, message) {
  const body = assistant.querySelector('.body')
  let chips = body.querySelector('.chips')
  if (!chips) { chips = document.createElement('div'); chips.className = 'chips'; body.appendChild(chips) }
  const c = document.createElement('span')
  c.className = 'chip err'
  c.textContent = `error: ${message}`
  chips.appendChild(c)
}

function setSending(on) {
  $('send').disabled = on
  $('input').disabled = on
}

function autoGrow(ta) {
  ta.style.height = 'auto'
  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
}

function scrollDown() {
  const t = $('thread')
  t.scrollTop = t.scrollHeight
}

// ---------------------------------------------------------------------------
// Minimal SSE reader over fetch's ReadableStream. Frames are separated by a
// blank line; each frame has `event:` and `data:` lines.
// ---------------------------------------------------------------------------
async function readSSE(stream, onEvent) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let i
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, i)
      buf = buf.slice(i + 2)
      let event = 'message'
      const dataLines = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      const data = dataLines.join('\n')
      if (data === '[DONE]') return
      await onEvent(event, data)
    }
  }
}

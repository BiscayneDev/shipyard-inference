// Chat portal client — talks to the portal server's /api/* endpoints, streams
// replies over SSE, renders markdown, and keeps the wallet + savings panels live.
const $ = (id) => document.getElementById(id)
const fmt = (n, d = 6) => '$' + (Number(n) || 0).toFixed(d)

const state = {
  sessionId: localStorage.getItem('portal.session') || null,
  messages: [], // {role, content}
  model: 'auto',
  catalog: [],
  baselineModel: 'baseline',
  sending: false,
  inferenceMode: 'demo', // 'demo' (mock) | 'production' (real wallet-funded)
  productionAvailable: false,
}

// A representative chat blend (input-heavy context, output-heavy answer) so the
// picker can preview savings vs the baseline without knowing the real token mix.
const blended = (m) =>
  (Number(m?.inputCostPerMTok) || 0) * 0.25 + (Number(m?.outputCostPerMTok) || 0) * 0.75

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
init()
async function init() {
  await loadModels()
  if (state.sessionId) await refreshWallet()

  for (const b of document.querySelectorAll('.wallet-choice')) {
    b.addEventListener('click', () => connectWallet(b.dataset.wallet))
  }
  $('composer').addEventListener('submit', onSubmit)
  $('new-chat').addEventListener('click', resetChat)
  $('model-trigger').addEventListener('click', toggleModelMenu)
  for (const b of document.querySelectorAll('.infmode-opt')) {
    b.addEventListener('click', () => setInferenceMode(b.dataset.infmode))
  }
  $('placement-cta')?.addEventListener('click', recordClick)
  $('topup-toggle').addEventListener('click', () => $('topup').classList.toggle('hidden'))
  $('topup').addEventListener('click', (e) => {
    const amt = e.target.closest('.topup-amt')?.dataset.amt
    if (amt) topUp(Number(amt))
  })
  $('disconnect').addEventListener('click', disconnectWallet)
  $('examples')?.addEventListener('click', (e) => {
    const prompt = e.target.closest('.example')?.dataset.prompt
    if (!prompt || state.sending) return
    $('input').value = prompt
    onSubmit(new Event('submit'))
  })
  document.addEventListener('click', (e) => {
    if (!$('model-pick').contains(e.target)) closeModelMenu()
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModelMenu() })

  const ta = $('input')
  ta.addEventListener('input', () => autoGrow(ta))
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e) }
  })
}

async function loadModels() {
  try {
    const res = await fetch(`/api/models?mode=${state.inferenceMode}`)
    const { models, baselineModel, backend, productionAvailable } = await res.json()
    state.catalog = models
    state.baselineModel = baselineModel
    state.productionAvailable = !!productionAvailable
    $('baseline-name').textContent = baselineModel
    setModeBadge(backend)
    applyInferenceModeUI()
    renderModelMenu()
    selectModel(state.model, { silent: true })
  } catch {
    state.catalog = [{ id: 'auto', label: 'Auto — cheapest capable', tier: 'auto' }]
    renderModelMenu()
  }
}

// Reflect the inference-mode toggle: highlight the active option and disable
// Production when the server has no production backend configured.
function applyInferenceModeUI() {
  const prodBtn = $('infmode-prod')
  if (prodBtn) {
    prodBtn.disabled = !state.productionAvailable
    prodBtn.title = state.productionAvailable
      ? 'Real wallet-funded inference'
      : 'Set USEPOD_TOKEN (or a Paybox/x402 backend) to enable production'
  }
  for (const b of document.querySelectorAll('.infmode-opt')) {
    b.classList.toggle('active', b.dataset.infmode === state.inferenceMode)
  }
}

// Switch demo ⇄ production: reload that backend's model catalog + baseline and
// reset to Auto (model ids differ per backend).
async function setInferenceMode(mode) {
  if (mode === 'production' && !state.productionAvailable) return
  if (mode === state.inferenceMode) return
  state.inferenceMode = mode
  state.model = 'auto'
  applyInferenceModeUI()
  await loadModels()
}

function setModeBadge(mode) {
  const el = $('mode-badge')
  if (!el || !mode) return
  const label = { demo: 'demo', usepod: 'usepod', paybox: 'paybox · live' }[mode] ?? mode
  const tip = {
    demo: 'Built-in mock model — no real inference is billed.',
    usepod: 'Wallet-funded inference — prepaid USDC via UsePod, no API key.',
    paybox: 'REAL inference — your funded Paybox wallet pays per-request USDC over x402.',
  }[mode] ?? ''
  el.textContent = label
  el.title = tip
  el.className = `mode-badge ${mode}`
}

// ---------------------------------------------------------------------------
// Model picker — a custom dropdown with per-model pricing + savings preview.
// ---------------------------------------------------------------------------
function baselineBlend() {
  const b = state.catalog.find((m) => m.id === state.baselineModel)
  return b ? blended(b) : 0
}

function savingsPct(m) {
  const base = baselineBlend()
  if (!base || m.tier === 'auto') return 0
  return Math.max(0, Math.round((1 - blended(m) / base) * 100))
}

// Best (cheapest) saving among real models — what "Auto" can deliver.
function bestSavingsPct() {
  return state.catalog
    .filter((m) => m.tier !== 'auto')
    .reduce((best, m) => Math.max(best, savingsPct(m)), 0)
}

function pricingLine(m) {
  if (m.tier === 'auto') return 'Routes every prompt to the cheapest capable model'
  const inP = (Number(m.inputCostPerMTok) || 0).toFixed(2)
  const outP = (Number(m.outputCostPerMTok) || 0).toFixed(2)
  return `$${inP} in · $${outP} out / Mtok`
}

function renderModelMenu() {
  const menu = $('model-menu')
  menu.innerHTML = ''
  for (const m of state.catalog) {
    const pct = m.tier === 'auto' ? bestSavingsPct() : savingsPct(m)
    const row = document.createElement('button')
    row.className = 'model-row'
    row.type = 'button'
    row.dataset.id = m.id
    row.setAttribute('role', 'option')
    const save =
      pct > 0
        ? `<span class="model-save">${m.tier === 'auto' ? `up to ${pct}% off` : `saves ~${pct}%`}</span>`
        : ''
    row.innerHTML = `
      <span class="tier-badge ${m.tier}">${m.tier}</span>
      <span class="model-row-main">
        <span class="model-row-name">${escapeHtml(m.label)}</span>
        <span class="model-row-price muted">${escapeHtml(pricingLine(m))}</span>
      </span>
      ${save}`
    row.addEventListener('click', () => { selectModel(m.id); closeModelMenu() })
    menu.appendChild(row)
  }
}

function selectModel(id, { silent } = {}) {
  const m = state.catalog.find((x) => x.id === id) ?? state.catalog[0]
  if (!m) return
  state.model = m.id
  $('model-trigger-label').textContent = m.label
  for (const row of $('model-menu').children) {
    row.classList.toggle('active', row.dataset.id === m.id)
  }
  if (!silent) closeModelMenu()
}

function toggleModelMenu() {
  const menu = $('model-menu')
  const open = menu.classList.toggle('hidden')
  $('model-trigger').setAttribute('aria-expanded', String(!open))
}
function closeModelMenu() {
  $('model-menu').classList.add('hidden')
  $('model-trigger').setAttribute('aria-expanded', 'false')
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
function connectError(msg) {
  const note = $('connect-note')
  note.textContent = msg
  note.classList.add('error')
}

async function connectWallet(wallet = 'paybox') {
  $('connect-note').classList.remove('error')

  // Bring-your-own non-custodial wallet: get the real on-chain address from the
  // browser wallet, so the server provisions/funds a UsePod token for it.
  let address
  if (wallet === 'phantom') {
    if (!window.ShipyardWallet?.hasPhantom()) {
      return connectError('Phantom not detected — install the Phantom wallet extension, then retry.')
    }
    try {
      address = await window.ShipyardWallet.connectPhantom()
    } catch (err) {
      return connectError(err?.message || 'Phantom connection was rejected.')
    }
  } else if (wallet === 'metamask') {
    return connectError('MetaMask is EVM — this rail settles USDC on Solana. Use Phantom or Paybox.')
  }

  const res = await fetch('/api/wallet/connect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: state.sessionId, wallet, address }),
  })
  const w = await res.json()
  state.sessionId = w.sessionId
  localStorage.setItem('portal.session', w.sessionId)
  applyWallet(w)
}

// Disconnect: drop the local session (and the browser wallet, if non-custodial)
// and return to the connect panel. The thread resets with the reload.
async function disconnectWallet() {
  try { await window.phantom?.solana?.disconnect?.() } catch { /* ignore */ }
  localStorage.removeItem('portal.session')
  state.sessionId = null
  location.reload()
}

async function refreshWallet() {
  try {
    const w = await (await fetch(`/api/wallet/${state.sessionId}`)).json()
    if (w.error) { state.sessionId = null; localStorage.removeItem('portal.session'); return }
    applyWallet(w)
  } catch { /* offline-ok */ }
}

const postJSON = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())

async function topUp(amountUsd) {
  if (!state.sessionId) return
  const toggle = $('topup-toggle')
  const label = toggle.textContent
  const fail = (msg) => {
    toggle.textContent = 'deposit failed'
    toggle.title = msg || ''
    setTimeout(() => { toggle.textContent = label; toggle.title = '' }, 2800)
  }
  toggle.disabled = true
  try {
    let r
    if (state.wallet === 'phantom' && state.usepodToken) {
      // Real on-chain deposit: server builds → Phantom signs in-browser → server submits.
      toggle.textContent = 'building…'
      const built = await postJSON('/api/wallet/deposit/build', { sessionId: state.sessionId, amountUsd })
      if (built.error) return fail(built.error)
      toggle.textContent = 'approve in Phantom…'
      const signedTransactionBase64 = await window.ShipyardWallet.signTransactionBase64(built.transactionBase64)
      toggle.textContent = 'submitting…'
      r = await postJSON('/api/wallet/deposit/submit', { sessionId: state.sessionId, signedTransactionBase64 })
    } else {
      toggle.textContent = 'depositing…'
      r = await postJSON('/api/wallet/topup', { sessionId: state.sessionId, amountUsd })
    }
    if (r.wallet) applyWallet(r.wallet)
    if (r.error) return fail(r.error)
    $('topup').classList.add('hidden')
    toggle.textContent = label
  } catch (err) {
    fail(err?.message)
  } finally {
    toggle.disabled = false
  }
}

const WALLET_LABEL = {
  paybox: 'Paybox · smart account',
  phantom: 'Phantom wallet',
  metamask: 'MetaMask wallet',
}

function applyWallet(w) {
  state.wallet = w.wallet
  state.usepodToken = w.usepodToken
  $('connect-panel').classList.add('hidden')
  $('wallet-card').classList.remove('hidden')
  $('wallet-label').textContent = WALLET_LABEL[w.wallet] ?? 'Wallet'
  $('addr').textContent = w.address
  $('addr').title = w.address
  $('balance').textContent = fmt(w.balanceUsd)
  // Tender: show what's actually owed after netting the idle-attention credit,
  // and surface the credit itself when present.
  const credit = w.tenderCreditUsd || 0
  $('pending').textContent = fmt(w.netOwedUsd !== undefined ? w.netOwedUsd : w.pendingUsd)
  const creditRow = $('credit-row')
  if (creditRow) creditRow.classList.toggle('hidden', !(credit > 0))
  if ($('tender-credit')) $('tender-credit').textContent = '−' + fmt(credit)
  $('mode-pill').textContent = w.mode
  // A real (wallet-provisioned) session leaves demo — reflect it in the top badge,
  // not just the sidebar pill, so it's clear real inference is on for this session.
  if (w.realInference) setModeBadge(w.mode)
  $('msg-total').textContent = w.messages
  // baselineTotal is tracked client-side (spent + saved ≈ what direct would cost).
  const baseline = (w.spentUsd || 0) + (w.savedUsd || 0)
  $('baseline-total').textContent = fmt(baseline, 2)
  $('spent-total').textContent = fmt(w.spentUsd, 2)
  $('saved-total').textContent = fmt(w.savedUsd)
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
  ta.value = ''
  autoGrow(ta)
  state.messages.push({ role: 'user', content: text })
  renderMessage('user', text)
  await runTurn()
}

// Re-run the last turn: drop the previous assistant reply (thread + history)
// and ask again. state.messages then ends on the user turn, as runTurn expects.
async function regenerateLast() {
  if (state.sending) return
  if (state.messages.at(-1)?.role === 'assistant') state.messages.pop()
  const assistants = $('thread').querySelectorAll('.msg.assistant')
  assistants[assistants.length - 1]?.remove()
  await runTurn()
}

// Stream one assistant turn. Assumes state.messages ends with a user message.
async function runTurn() {
  const assistant = renderMessage('assistant', '')
  const contentEl = assistant.querySelector('.content')
  contentEl.classList.add('streaming')
  contentEl.innerHTML = '<span class="cursor">▍</span>'

  state.sending = true
  setSending(true)
  clearPlacement() // drop any stale sponsored line before this turn's wait

  let acc = ''
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages,
        model: state.model,
        sessionId: state.sessionId,
        mode: state.inferenceMode,
      }),
    })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    await readSSE(res.body, async (evt, data) => {
      if (evt === 'delta') {
        acc += JSON.parse(data).text
        // Stream as plain text (fast); swap to rendered markdown at the end.
        contentEl.textContent = acc
        contentEl.insertAdjacentHTML('beforeend', '<span class="cursor">▍</span>')
        scrollDown()
      } else if (evt === 'meta') {
        contentEl.classList.remove('streaming')
        contentEl.innerHTML = renderMarkdown(acc)
        assistant.dataset.raw = acc
        const meta = JSON.parse(data)
        renderChips(assistant, meta)
        renderActions(assistant)
        if (meta.wallet) applyWallet(meta.wallet)
        await settle(assistant)
      } else if (evt === 'placement') {
        // Tender side channel: render the sponsored line in chrome, OUTSIDE the
        // message bubble — never appended to `acc` / the model output.
        renderPlacement(JSON.parse(data))
      } else if (evt === 'attestation') {
        renderAttestation(JSON.parse(data))
      } else if (evt === 'placement_clear') {
        clearPlacement()
      } else if (evt === 'error') {
        contentEl.innerHTML = renderMarkdown(acc)
        renderError(assistant, JSON.parse(data).message)
      }
    })

    if (acc) state.messages.push({ role: 'assistant', content: acc })
  } catch (err) {
    contentEl.innerHTML = renderMarkdown(acc)
    renderError(assistant, err.message)
  } finally {
    contentEl.querySelector('.cursor')?.remove()
    contentEl.classList.remove('streaming')
    state.sending = false
    setSending(false)
  }
}

async function settle(assistant) {
  if (!state.sessionId) return
  const t0 = performance.now()
  try {
    const r = await (await fetch('/api/settle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId }),
    })).json()
    if (r.wallet) applyWallet(r.wallet)
    if (r.error) {
      const chips = assistant.querySelector('.chips')
      const chip = document.createElement('span')
      chip.className = 'chip err'
      chip.textContent = 'settle pending — will retry'
      chip.title = r.error
      chips?.appendChild(chip)
      return
    }
    if (r.settled > 0) {
      const ms = Math.round(performance.now() - t0)
      const chips = assistant.querySelector('.chips')
      const link = document.createElement('a')
      link.className = 'chip settle'
      link.href = r.explorerUrl || '#'
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.title = r.simulated
        ? `Simulated USDC settlement (demo) · ${shortSig(r.signature)} · ${ms}ms`
        : `USDC settled on Solana ${r.network} · ${shortSig(r.signature)} · ${ms}ms`
      link.innerHTML = `settled <b>${fmt(r.settled)}</b> · ${shortSig(r.signature)} ↗ <span class="muted">${ms}ms</span>`
      chips?.appendChild(link)
    }
  } catch { /* leave metered as pending */ }
}

const shortSig = (s) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : 'tx')

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

  if (meta.model) add('', `<b>${escapeHtml(meta.model)}</b>${meta.provider ? ' · ' + escapeHtml(meta.provider) : ''}`)
  if (meta.usage) add('', `${meta.usage.inputTokens}→${meta.usage.outputTokens} tok`)
  if (meta.actualCostUsd !== undefined) add('', `cost <b>${fmt(meta.actualCostUsd)}</b>`)
  if (meta.savedUsd > 0 && meta.baselineCostUsd !== undefined) {
    const pct = Math.round((meta.savedUsd / meta.baselineCostUsd) * 100)
    add('saved', `saved <b>${fmt(meta.savedUsd)}</b> (${pct}%)`)
  }
}

function renderActions(assistant) {
  const body = assistant.querySelector('.body')
  if (body.querySelector('.actions')) return
  const row = document.createElement('div')
  row.className = 'actions'
  row.innerHTML = `
    <button class="act" data-act="copy" title="Copy reply">⧉ Copy</button>
    <button class="act" data-act="regen" title="Regenerate">↻ Regenerate</button>`
  row.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
    navigator.clipboard?.writeText(assistant.dataset.raw || '')
    const b = e.currentTarget; const t = b.textContent; b.textContent = '✓ Copied'
    setTimeout(() => { b.textContent = t }, 1200)
  })
  row.querySelector('[data-act="regen"]').addEventListener('click', regenerateLast)
  body.appendChild(row)
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
// Minimal, safe markdown → HTML. Escapes first, then formats. Handles fenced
// code (with a language label + copy button), headings, lists, bold/italic,
// inline code, and links. No external library — the portal stays zero-build.
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inline(raw) {
  const stash = []
  const keep = (html) => { stash.push(html); return `\uE000${stash.length - 1}\uE000` }
  let s = raw
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${escapeHtml(c)}</code>`))
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) =>
    keep(`<a href="${escapeHtml(u)}" target="_blank" rel="noreferrer">${escapeHtml(t)}</a>`))
  s = escapeHtml(s)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
  s = s.replace(/\uE000(\d+)\uE000/g, (_, n) => stash[Number(n)] ?? '')
  return s
}

function codeBlock(code, lang) {
  return `<div class="code">
    <div class="code-head"><span class="code-lang">${escapeHtml(lang || 'code')}</span><button class="code-copy" type="button">Copy</button></div>
    <pre><code>${escapeHtml(code)}</code></pre>
  </div>`
}

function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n')
  let html = ''
  let i = 0
  let list = null // 'ul' | 'ol'
  const closeList = () => { if (list) { html += `</${list}>`; list = null } }

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      closeList()
      const buf = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++ // closing fence
      html += codeBlock(buf.join('\n'), fence[1])
      continue
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) { closeList(); const lvl = h[1].length + 2; html += `<h${lvl}>${inline(h[2])}</h${lvl}>`; i++; continue }

    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    if (ul) { if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul' } html += `<li>${inline(ul[1])}</li>`; i++; continue }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ol) { if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol' } html += `<li>${inline(ol[1])}</li>`; i++; continue }

    if (/^\s*$/.test(line)) { closeList(); i++; continue }

    closeList()
    const para = [line]
    i++
    while (i < lines.length &&
      !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) &&
      !/^#{1,3}\s/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) {
      para.push(lines[i]); i++
    }
    html += `<p>${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`
  }
  closeList()
  return html
}

// Copy buttons inside rendered code blocks (event delegation on the thread).
$('thread').addEventListener('click', (e) => {
  const btn = e.target.closest('.code-copy')
  if (!btn) return
  const code = btn.closest('.code')?.querySelector('pre code')?.textContent ?? ''
  navigator.clipboard?.writeText(code)
  const t = btn.textContent; btn.textContent = 'Copied'
  setTimeout(() => { btn.textContent = t }, 1200)
})

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

// ---------------------------------------------------------------------------
// Tender — render a won placement in surface chrome (a slim bar above the
// composer), structurally separate from the message thread. The sponsored line
// is NEVER part of the assistant message content; it arrives on its own SSE
// event and lives in its own DOM region. A "click" = opening endpointUrl.
// ---------------------------------------------------------------------------
function renderPlacement(p) {
  const bar = $('placement-bar')
  if (!bar || !p || !p.line) return
  state.placement = p // for click = call
  $('placement-line').textContent = p.line
  const attest = $('placement-attest')
  if (attest) { attest.textContent = ''; attest.className = 'placement-attest' } // reset; set on attestation
  const cta = $('placement-cta')
  cta.href = p.endpointUrl || '#'
  cta.dataset.placementId = p.placementId || ''
  bar.classList.remove('hidden')
}

// Proof-of-impression badge: the gateway-signed attestation result. Valid means
// a real, billed request produced this impression (the moat). In Demo mode it's
// unverified — no real inference was billed.
function renderAttestation(d) {
  const el = $('placement-attest')
  if (!el) return
  if (d && d.valid) {
    el.textContent = d.creditedUsd ? `✓ attested · +${fmt(d.creditedUsd)}` : '✓ attested'
    el.className = 'placement-attest ok'
    el.title = `Gateway-signed proof-of-impression · ${d.attestation?.measuredWaitMs ?? 0}ms billed wait · credit ${fmt(d.creditedUsd || 0)}`
  } else {
    el.textContent = '⚠ unverified'
    el.className = 'placement-attest bad'
    el.title = d?.reason || 'no valid attestation'
  }
}

function clearPlacement() {
  $('placement-bar')?.classList.add('hidden')
  state.placement = null
}

// Click = call: invoking the sponsored endpoint bills CLICK_MULTIPLIER × the
// impression and credits the wallet. We record the click, then let the link open
// the endpoint (the ad and the transaction are the same call). Non-blocking.
async function recordClick() {
  const p = state.placement
  if (!p) return
  try {
    const res = await fetch('/api/tender/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, requestId: p.requestId, placementId: p.placementId }),
    })
    const d = await res.json()
    if (d.wallet) applyWallet(d.wallet)
    if (d.creditedUsd) {
      const el = $('placement-attest')
      if (el) { el.textContent = `✓ clicked · +${fmt(d.creditedUsd)}`; el.className = 'placement-attest ok' }
    }
  } catch {
    /* a failed click record never blocks opening the endpoint */
  }
}

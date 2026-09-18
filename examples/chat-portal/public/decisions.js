// Decisions view — the System One surface (TypeSafe Jev) in the portal.
// Builds typed questions (noul / choice / score), POSTs /api/decisions, and
// renders the typed answers as confidence-metered cards. View switching
// between Chat and Decisions lives here so app.js stays chat-only.
const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' })[c])

let CFG = { live: false, model: 'stub-latest', inputPerMTok: 0.042 }
let questions = [] // {type, instructions, criteria}
let asking = false

// ---------------------------------------------------------------------------
// View switching — beautifului Sidebar Nav: gliding hover pill + collapse rail
// ---------------------------------------------------------------------------
const chatMain = document.querySelector('main.chat:not(.dec)')
const decMain = $('decisions')
const viewnav = $('viewnav')
const glider = $('nav-glider')

/** Position the gliding pill behind the hovered/active option. */
function glideTo(btn) {
  if (!glider || !btn) return
  glider.style.top = btn.offsetTop + 'px'
  glider.style.height = btn.offsetHeight + 'px'
}

function setView(view) {
  for (const b of document.querySelectorAll('.viewnav-opt')) {
    b.classList.toggle('active', b.dataset.view === view)
    if (b.dataset.view === view) glideTo(b)
  }
  chatMain?.classList.toggle('hidden', view !== 'chat')
  decMain.classList.toggle('hidden', view !== 'decisions')
}
for (const b of document.querySelectorAll('.viewnav-opt')) {
  b.addEventListener('click', () => setView(b.dataset.view))
  b.addEventListener('mouseenter', () => glideTo(b))
}
viewnav?.addEventListener('mouseleave', () => {
  glideTo(document.querySelector('.viewnav-opt.active'))
})

// Collapse to an icon rail (persisted).
const collapseBtn = $('nav-collapse')
if (collapseBtn) {
  if (localStorage.getItem('portal.nav-collapsed') === '1') viewnav?.classList.add('viewnav-collapsed')
  collapseBtn.addEventListener('click', () => {
    const collapsed = viewnav.classList.toggle('viewnav-collapsed')
    localStorage.setItem('portal.nav-collapsed', collapsed ? '1' : '0')
    collapseBtn.textContent = collapsed ? '»' : '«'
    // the active option may shift as the rail reflows — re-glide after layout
    requestAnimationFrame(() => glideTo(document.querySelector('.viewnav-opt.active')))
  })
  collapseBtn.textContent = viewnav.classList.contains('viewnav-collapsed') ? '»' : '«'
}
// Initial glide once layout settles.
requestAnimationFrame(() => glideTo(document.querySelector('.viewnav-opt.active')))

// ---------------------------------------------------------------------------
// Question builder
// ---------------------------------------------------------------------------
function addQuestion(type) {
  if (questions.length >= 6) return
  const q = { type, instructions: '' }
  if (type === 'choice') q.criteria = { option_a: 'Describe when this option applies', option_b: 'Describe when this option applies' }
  if (type === 'score') q.criteria = ['lowest level', 'middle level', 'highest level']
  questions.push(q)
  renderQuestions()
}

function renderQuestions() {
  const host = $('dec-questions')
  host.innerHTML = ''
  questions.forEach((q, i) => {
    const card = document.createElement('div')
    card.className = 'dec-q'
    card.draggable = true
    card.dataset.i = i

    const typePills = ['noul', 'choice', 'score']
      .map(
        (t) =>
          `<button class="qtype ${q.type === t ? 'active' : ''}" data-i="${i}" data-t="${t}">${t}</button>`,
      )
      .join('')

    let criteriaHtml = ''
    if (q.type === 'choice') {
      criteriaHtml =
        '<div class="dec-criteria">' +
        Object.entries(q.criteria)
          .map(
            ([k, v], j) =>
              `<div class="crit-row" data-i="${i}" data-j="${j}">
                 <input class="crit-k mono" value="${esc(k)}" placeholder="option_id" />
                 <input class="crit-v" value="${esc(v)}" placeholder="When this option applies" />
                 <button class="btn ghost tiny crit-del" data-i="${i}" data-j="${j}" title="Remove option">×</button>
               </div>`,
          )
          .join('') +
        `<button class="btn ghost tiny crit-add" data-i="${i}">+ option</button></div>`
    } else if (q.type === 'score') {
      criteriaHtml =
        '<div class="dec-criteria">' +
        q.criteria
          .map(
            (v, j) =>
              `<div class="crit-row" data-i="${i}" data-j="${j}">
                 <span class="crit-idx mono">${j}</span>
                 <input class="crit-v" value="${esc(v)}" placeholder="Level ${j + 1} description" />
                 <button class="btn ghost tiny crit-del" data-i="${i}" data-j="${j}" title="Remove level">×</button>
               </div>`,
          )
          .join('') +
        `<button class="btn ghost tiny crit-add" data-i="${i}">+ level</button></div>`
    } else {
      criteriaHtml = `<input class="noul-clarify" data-i="${i}" value="" placeholder="Optional — clarify what yes and no mean" />`
    }

    card.innerHTML = `
      <div class="dec-q-head">
        <div class="qtype-row">${typePills}</div>
        <button class="btn ghost tiny q-del" data-i="${i}" title="Remove question">×</button>
      </div>
      <input class="q-instr" data-i="${i}" value="${esc(q.instructions)}" placeholder="The judgment to make about the state — one well-scoped question" />
      ${criteriaHtml}
    `
    host.appendChild(card)
  })
}

// Delegated events for the builder
$('dec-questions').addEventListener('click', (e) => {
  const t = e.target
  const i = Number(t.dataset?.i)
  if (t.classList.contains('q-del')) {
    questions.splice(i, 1)
    renderQuestions()
  } else if (t.classList.contains('qtype')) {
    const old = questions[i]
    const type = t.dataset.t
    if (type === old.type) return
    const q = { type, instructions: old.instructions }
    if (type === 'choice') q.criteria = { option_a: 'Describe when this option applies', option_b: 'Describe when this option applies' }
    if (type === 'score') q.criteria = ['lowest level', 'middle level', 'highest level']
    questions[i] = q
    renderQuestions()
  } else if (t.classList.contains('crit-del')) {
    const q = questions[i]
    if (q.type === 'choice') delete q.criteria[t.dataset.j]
    else q.criteria.splice(Number(t.dataset.j), 1)
    renderQuestions()
  } else if (t.classList.contains('crit-add')) {
    const q = questions[i]
    if (q.type === 'choice') {
      const n = Object.keys(q.criteria).length
      q.criteria[`option_${String.fromCharCode(97 + n)}`] = 'Describe when this option applies'
    } else q.criteria.push(`level ${q.criteria.length + 1}`)
    renderQuestions()
  }
})
$('dec-questions').addEventListener('input', (e) => {
  const t = e.target
  const i = Number(t.dataset?.i)
  const q = questions[i]
  if (!q) return
  if (t.classList.contains('q-instr')) q.instructions = t.value
  else if (t.classList.contains('crit-k')) {
    const j = t.dataset.j
    const v = q.criteria[j]
    delete q.criteria[j]
    q.criteria[t.value || `option_${Object.keys(q.criteria).length}`] = v
    t.dataset.j = Object.keys(q.criteria).find((k) => q.criteria[k] === v) ?? t.dataset.j
  } else if (t.classList.contains('crit-v')) q.criteria[t.dataset.j] = t.value
  else if (t.classList.contains('noul-clarify')) q.clarify = t.value
})
for (const b of document.querySelectorAll('.dec-add')) {
  b.addEventListener('click', () => addQuestion(b.dataset.type))
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
$('dec-preset-ticket').addEventListener('click', () => {
  $('dec-state').value =
    "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP."
  questions = [
    { type: 'choice', instructions: 'Which team should handle this', criteria: { billing: 'Payment or subscription issues', technical: 'Bugs or integration problems', sales: 'Pricing or account questions' } },
    { type: 'score', instructions: 'How frustrated the customer appears', criteria: ['Calm, just stating facts', 'Frustrated but civil', 'Very angry, strong language'] },
    { type: 'noul', instructions: 'The message conveys urgency or time-sensitivity' },
  ]
  enterBuilder()
})
$('dec-preset-router').addEventListener('click', () => {
  $('dec-state').value =
    'Please design the schema for a multi-tenant billing system with usage metering, then explain the tradeoffs versus a simpler single-table design.'
  questions = [
    { type: 'choice', instructions: 'What minimum model quality does answering this request well require?', criteria: { economy: 'Simple, casual, or well-defined tasks', standard: 'Professional or technical work', frontier: 'High-stakes or deeply complex work' } },
    { type: 'noul', instructions: 'Answering this well requires careful multi-step reasoning.' },
  ]
  enterBuilder()
})
function enterBuilder() {
  $('dec-empty').classList.add('hidden')
  $('dec-grid').classList.remove('hidden')
  renderQuestions()
}

$('dec-clear').addEventListener('click', () => {
  questions = []
  $('dec-state').value = ''
  $('dec-results').innerHTML = ''
  $('dec-grid').classList.add('hidden')
  $('dec-empty').classList.remove('hidden')
})

// ---------------------------------------------------------------------------
// Ask
// ---------------------------------------------------------------------------
$('dec-ask').addEventListener('click', async () => {
  if (asking) return
  const state = $('dec-state').value.trim()
  if (!state || questions.length === 0) {
    flash('Add a state and at least one question')
    return
  }
  const qobj = {}
  for (const [i, q] of questions.entries()) {
    if (!q.instructions.trim()) {
      flash(`Question ${i + 1} needs instructions`)
      return
    }
    const key = 'q' + (i + 1)
    qobj[key] =
      q.type === 'noul'
        ? { type: 'noul', instructions: q.instructions, ...(q.clarify ? { criteria: q.clarify } : {}) }
        : { type: q.type, instructions: q.instructions, criteria: q.criteria }
  }

  asking = true
  $('dec-ask').disabled = true
  $('dec-ask').textContent = 'Churning…'
  try {
    const res = await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, questions: qobj, sessionId: localStorage.getItem('portal.session') }),
    })
    const body = await res.json()
    if (!res.ok) {
      flash(body.error || `decisions failed (${res.status})`)
      return
    }
    renderAnswer(state, qobj, body)
  } catch (err) {
    flash(err?.message ?? 'network error')
  } finally {
    asking = false
    $('dec-ask').disabled = false
    $('dec-ask').innerHTML = `Ask ⩆ <span class="mono" id="dec-ask-price"></span>`
  }
})

function flash(msg) {
  const el = $('dec-ask')
  const old = el.innerHTML
  el.textContent = msg
  setTimeout(() => (el.innerHTML = old), 2600)
}

// ---------------------------------------------------------------------------
// Render — beautifului patterns: recommendation cards with confidence
// meters, probability bars, score ladders, and task-row cost chips.
// ---------------------------------------------------------------------------
function renderAnswer(state, qobj, body) {
  const wrap = document.createElement('div')
  wrap.className = 'dec-answer'

  const chips = [
    chip('model', body.model),
    chip('in', `${body.usage?.inputTokens ?? 0} tok`),
    chip('out', `${body.usage?.outputTokens ?? 0} tok · free`),
    chip('cost', '$' + (Number(body.chargedUsd) || 0).toFixed(6)),
  ]
  if (body.receipt) {
    chips.push(
      chip('receipt', `settled $${body.receipt.amountUsd} · refunded $${body.receipt.refundedUsd}`, 'pos'),
    )
  }
  if (!body.live) chips.push(chip('stub', 'offline stub — same wire shape as live Jev'))

  const cards = Object.entries(body.answers)
    .map(([key, ans]) => answerCard(key, qobj[key], ans))
    .join('')

  const stateLine = esc(state.length > 220 ? state.slice(0, 220) + '…' : state)
  wrap.innerHTML = `
    <div class="dec-ans-state"><span class="muted">state ·</span> ${stateLine}</div>
    <div class="dec-cards">${cards}</div>
    <div class="dec-taskrow">${chips.join('')}</div>
  `
  const results = $('dec-results')
  results.prepend(wrap)

  // Hand the snapshot to app.js's wallet renderer.
  if (body.wallet) window.dispatchEvent(new CustomEvent('portal:wallet', { detail: body.wallet }))
  // Feed the spend ticker its decision event.
  window.dispatchEvent(new CustomEvent('portal:decision', { detail: body }))
}

function chip(k, v, cls = '') {
  return `<span class="dec-chip ${cls}"><span class="dec-chip-k">${esc(k)}</span> ${esc(v)}</span>`
}

function confidenceMeter(c) {
  const pct = Math.round((Number(c) || 0) * 100)
  const label = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low'
  const color = pct >= 70 ? 'var(--accent-2)' : pct >= 40 ? 'var(--amber)' : 'var(--danger)'
  return `
    <div class="meter">
      <div class="meter-fill" style="width:${pct}%; background:${color}"></div>
    </div>
    <div class="meter-label mono">${pct}% · ${label} confidence</div>
  `
}

function answerCard(key, q, ans) {
  const instr = esc(q?.instructions ?? '')
  let inner = ''
  if (ans.type === 'choice') {
    const entries = Object.entries(ans.probabilities ?? {}).sort((a, b) => b[1] - a[1])
    const bars = entries
      .map(([k, p]) => {
        const pct = Math.round(p * 100)
        const winner = k === ans.choice ? ' winner' : ''
        return `<div class="pbar-row${winner}">
          <span class="pbar-k mono">${esc(k)}</span>
          <div class="pbar"><div class="pbar-fill" style="width:${pct}%"></div></div>
          <span class="pbar-v mono">${pct}%</span>
        </div>`
      })
      .join('')
    inner = `
      <div class="dec-choice">${esc(ans.choice)}</div>
      ${bars}
      <div class="dec-conf">${confidenceMeter(ans.confidence)}</div>
    `
  } else if (ans.type === 'score') {
    const legend = Object.values(ans.legend ?? {})
    const n = Math.max(legend.length - 1, 1)
    const pos = Math.min(100, Math.max(0, (Number(ans.score) / n) * 100))
    const levels = legend
      .map((lvl, i) => {
        const active = Math.round(Number(ans.score)) === i ? ' active' : ''
        return `<div class="level${active}"><span class="mono level-idx">${i}</span> ${esc(lvl)}</div>`
      })
      .join('')
    inner = `
      <div class="dec-score-row"><span class="dec-score mono">${Number(ans.score).toFixed(2)}</span>
      <span class="muted">of 0–${n}</span></div>
      <div class="ladder"><div class="ladder-mark" style="left:${pos}%"></div></div>
      <div class="levels">${levels}</div>
      <div class="dec-conf">${confidenceMeter(ans.confidence)}</div>
    `
  } else {
    const p = Number(ans.noul)
    const pct = Math.round(p * 100)
    const verdict = p >= 0.65 ? ['yes', 'var(--accent-2)'] : p <= 0.35 ? ['no', 'var(--danger)'] : ['uncertain', 'var(--amber)']
    inner = `
      <div class="noul-row">
        <div class="noul-gauge"><div class="noul-fill" style="width:${pct}%"></div></div>
        <span class="noul-pct mono">${pct}%</span>
        <span class="noul-verdict" style="color:${verdict[1]}">${verdict[0]}</span>
      </div>
    `
  }
  return `
    <div class="dec-ans-card t-${ans.type}">
      <div class="dec-ans-head"><span class="mono dec-ans-key">${esc(key)}</span><span class="dec-ans-type">${ans.type}</span></div>
      <div class="dec-ans-instr muted">${instr}</div>
      ${inner}
    </div>
  `
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
fetch('/api/decisions/config')
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => {
    if (!c) return
    CFG = c
    const badge = $('dec-mode-badge')
    badge.textContent = c.live ? 'jev · live' : 'jev · stub'
    badge.title = c.live
      ? 'Live TypeSafe Jev — typed decisions from api.typesafe.ai'
      : 'Offline stub backend — set TYPESAFE_API_KEY on the server for live Jev. Same wire shape, neutral answers.'
  })
// Rough ask-price hint: ~state tokens × list input price (output free).
$('dec-state').addEventListener('input', () => {
  const est = (Math.ceil($('dec-state').value.length / 4) / 1_000_000) * CFG.inputPerMTok
  $('dec-ask-price').textContent = est > 0 ? `≈ $${est.toFixed(6)}` : ''
})

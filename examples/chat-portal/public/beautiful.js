// Beautiful primitives layered onto the chat thread:
//   1. Thinking — expandable routing trace per reply (who was considered,
//      what won, what it cost) fed by the meta SSE event's `trace`.
//   2. Selection Actions — highlight a passage, hand it to the agent
//      (Explain / Improve / Shorten) as a normal follow-up turn.
//   3. Search — ⌘K command palette with live filtering over actions,
//      example prompts, models, and views.
const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' })[c])

// ---------------------------------------------------------------------------
// 1. Thinking — routing trace (built when meta arrives, before chips render)
// ---------------------------------------------------------------------------
const TRACE_ICON = { considered: '◌', served: '●', cache_hit: '◆', retry: '↻', failover: '⤳' }

export function renderRoutingTrace(assistant, meta) {
  const trace = meta?.trace
  if (!Array.isArray(trace) || trace.length === 0) return
  const contentEl = assistant.querySelector('.content')
  if (!contentEl) return

  const steps = trace
    .map((t) => {
      if (t.type === 'considered') {
        const est = t.estimatedCostUsd !== undefined ? ` · est $${Number(t.estimatedCostUsd).toFixed(6)}` : ''
        const won = trace.some((s) => s.type === 'served' && s.model === t.model && s.provider === t.provider)
        return `<div class="rt-step"><span class="rt-dot">${TRACE_ICON.considered}</span><span class="rt-k">considered</span><span class="rt-v">${esc(t.model ?? t.provider ?? '?')} · ${esc(t.provider ?? '')}${est}</span>${won ? '<span class="rt-won">won</span>' : ''}</div>`
      }
      if (t.type === 'served') {
        return `<div class="rt-step rt-served"><span class="rt-dot">${TRACE_ICON.served}</span><span class="rt-k">served</span><span class="rt-v">${esc(t.model ?? t.provider ?? '?')} (attempt ${t.attempt ?? 0})</span></div>`
      }
      if (t.type === 'cache_hit') {
        return `<div class="rt-step"><span class="rt-dot">${TRACE_ICON.cache_hit}</span><span class="rt-k">cache</span><span class="rt-v">hit ${esc(t.key)}</span></div>`
      }
      if (t.type === 'retry') {
        return `<div class="rt-step rt-warn"><span class="rt-dot">${TRACE_ICON.retry}</span><span class="rt-k">retry</span><span class="rt-v">${esc(t.model ?? t.provider ?? '')} · ${t.delayMs}ms backoff</span></div>`
      }
      if (t.type === 'failover') {
        return `<div class="rt-step rt-warn"><span class="rt-dot">${TRACE_ICON.failover}</span><span class="rt-k">failover</span><span class="rt-v">${esc(t.model ?? t.provider ?? '')} — ${esc(t.error ?? 'error')}</span></div>`
      }
      return ''
    })
    .join('')

  const nConsidered = trace.filter((t) => t.type === 'considered').length
  const label = nConsidered > 1 ? `${nConsidered} models considered` : 'routing'
  contentEl.insertAdjacentHTML(
    'afterend',
    `<details class="rt-trace">
       <summary><span class="caret">▶</span> Thinking · ${esc(label)}</summary>
       <div class="rt-body">${steps}</div>
     </details>`,
  )
}

// ---------------------------------------------------------------------------
// 2. Selection Actions — highlight a passage in any assistant reply
// ---------------------------------------------------------------------------
const SELECTION_ACTIONS = [
  { id: 'explain', label: 'Explain', prompt: (q) => `Explain this passage in plain terms:\n\n"${q}"` },
  { id: 'improve', label: 'Improve', prompt: (q) => `Improve this passage — clearer, tighter, same meaning:\n\n"${q}"` },
  { id: 'shorten', label: 'Shorten', prompt: (q) => `Shorten this passage while keeping the key point:\n\n"${q}"` },
]

let selBar = null
let selRange = null

function hideSelectionBar() {
  selBar?.remove()
  selBar = null
  selRange = null
}

document.addEventListener('selectionchange', () => {
  // Only care about selections inside assistant messages.
  const sel = window.getSelection()
  const text = sel?.toString().trim()
  if (!sel || sel.isCollapsed || !text || text.length < 3 || text.length > 1200) {
    hideSelectionBar()
    return
  }
  const anchor = sel.anchorNode
  const inAssistant = anchor?.nodeType === 1
    ? anchor.closest?.('.msg.assistant .content')
    : anchor?.parentElement?.closest?.('.msg.assistant .content')
  if (!inAssistant) {
    hideSelectionBar()
    return
  }
  selRange = sel.getRangeAt(0).cloneRange()
  showSelectionBar(inAssistant, text)
})

function showSelectionBar(contentEl, text) {
  hideSelectionBar()
  selBar = document.createElement('div')
  selBar.className = 'selbar'
  selBar.innerHTML =
    SELECTION_ACTIONS.map(
      (a) =>
        `<button class="btn ghost tiny selact" data-act="${a.id}" title="${esc(a.label)} this passage">${esc(a.label)}</button>`,
    ).join('<span class="selbar-sep"></span>') +
    `<span class="selbar-quote mono">“${esc(text.length > 42 ? text.slice(0, 42) + '…' : text)}”</span>`
  document.body.appendChild(selBar)
  positionBar(contentEl)
  for (const b of selBar.querySelectorAll('.selact')) {
    b.addEventListener('mousedown', (e) => e.preventDefault()) // keep the selection
    b.addEventListener('click', () => {
      const action = SELECTION_ACTIONS.find((a) => a.id === b.dataset.act)
      if (!action || !text) return
      hideSelectionBar()
      window.getSelection()?.removeAllRanges()
      // Hand the passage to the agent as a normal follow-up turn.
      const input = $('input')
      input.value = action.prompt(text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      $('composer')?.requestSubmit()
    })
  }
}

function positionBar(contentEl) {
  if (!selBar || !selRange) return
  const rect = selRange.getBoundingClientRect()
  const thread = contentEl.closest('.thread')
  const thRect = thread?.getBoundingClientRect()
  selBar.style.left = Math.max(12, rect.left - (thRect?.left ?? 0) + (thRect?.width ? 0 : 0)) + 'px'
  selBar.style.top = Math.max(8, rect.top - 46) + 'px'
}

document.addEventListener('scroll', hideSelectionBar, true)
window.addEventListener('resize', hideSelectionBar)

// ---------------------------------------------------------------------------
// 3. Search — ⌘K command palette (live filtering + empty state)
// ---------------------------------------------------------------------------
const COMMANDS = [
  { id: 'view:chat', label: 'Go to Chat', hint: 'view', run: () => document.querySelector('.navrail-opt[data-view="chat"]')?.click() },
  { id: 'view:decisions', label: 'Go to Decisions', hint: 'view', run: () => document.querySelector('.navrail-opt[data-view="decisions"]')?.click() },
  { id: 'view:history', label: 'Go to History', hint: 'view', run: () => document.querySelector('.navrail-opt[data-view="history"]')?.click() },
  { id: 'view:activity', label: 'Go to Activity', hint: 'view', run: () => document.querySelector('.navrail-opt[data-view="activity"]')?.click() },
  { id: 'act:new', label: 'New chat', hint: 'action', run: () => $('new-chat')?.click() },
  { id: 'act:regen', label: 'Regenerate last reply', hint: 'action', run: () => window.__portalRegenerate?.() },
  { id: 'act:toggle-prod', label: 'Toggle Demo / Production', hint: 'action', run: () => document.querySelector('.infmode-opt:not(.active)')?.click() },
  { id: 'act:wallet', label: 'Connect wallet', hint: 'action', run: () => document.getElementById('connect-open')?.click() },
  { id: 'ex:x402', label: 'Explain how x402 micropayments work', hint: 'prompt', run: () => runExample('Explain how x402 micropayments work, with a diagram in code.') },
  { id: 'ex:retry', label: 'Write a retry-with-backoff helper in TypeScript', hint: 'prompt', run: () => runExample('Write a TypeScript function that retries a fetch with exponential backoff.') },
  { id: 'ex:billing', label: 'Compare prepaid vs pay-per-request billing', hint: 'prompt', run: () => runExample('Compare prepaid balances vs pay-per-request billing for AI inference.') },
  { id: 'ex:tagline', label: 'Draft taglines for a wallet-funded gateway', hint: 'prompt', run: () => runExample('Draft a short product tagline for a wallet-funded AI gateway.') },
]
function runExample(prompt) {
  document.querySelector('.navrail-opt[data-view="chat"]')?.click()
  const input = $('input')
  input.value = prompt
  $('composer')?.requestSubmit()
}

let paletteOpen = false
let paletteIdx = 0

function buildPalette() {
  if ($('palette')) return
  const el = document.createElement('div')
  el.id = 'palette'
  el.className = 'hidden'
  el.innerHTML = `
    <div class="palette-scrim" data-close></div>
    <div class="palette-card" role="dialog" aria-label="Command palette">
      <input id="palette-input" placeholder="Search commands, prompts, views…" autocomplete="off" spellcheck="false" />
      <div class="palette-list" id="palette-list"></div>
      <div class="palette-foot">
        <span>↑↓ navigate</span><span>↵ run</span><span>esc close</span>
      </div>
    </div>`
  document.body.appendChild(el)
  $('palette-input').addEventListener('input', () => renderPaletteList())
  $('palette-input').addEventListener('keydown', onPaletteKey)
  el.addEventListener('click', (e) => {
    if (e.target.dataset?.close !== undefined || e.target.closest('[data-close]')) closePalette()
    const item = e.target.closest('.palette-item')
    if (item) runPalette(item.dataset.id)
  })
}

let paletteMatches = []

function renderPaletteList() {
  const q = ($('palette-input')?.value ?? '').trim().toLowerCase()
  paletteMatches = q
    ? COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
    : COMMANDS
  paletteIdx = 0
  const list = $('palette-list')
  if (paletteMatches.length === 0) {
    list.innerHTML = `<div class="palette-empty">No matches for “${esc(q)}” — try “routing”, “wallet”, or a model name.</div>`
    return
  }
  list.innerHTML = paletteMatches
    .map(
      (c, i) =>
        `<div class="palette-item${i === 0 ? ' active' : ''}" data-id="${c.id}">
           <span class="palette-label">${esc(c.label)}</span><span class="palette-hint">${esc(c.hint)}</span>
         </div>`,
    )
    .join('')
}

function onPaletteKey(e) {
  const items = $('palette-list').querySelectorAll('.palette-item')
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    paletteIdx = (paletteIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1)
    items.forEach((it, i) => it.classList.toggle('active', i === paletteIdx))
    items[paletteIdx]?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    runPalette(paletteMatches[paletteIdx]?.id)
  } else if (e.key === 'Escape') {
    closePalette()
  }
}

function runPalette(id) {
  const cmd = COMMANDS.find((c) => c.id === id)
  closePalette()
  cmd?.run()
}

function openPalette() {
  buildPalette()
  paletteOpen = true
  $('palette').classList.remove('hidden')
  $('palette-input').value = ''
  renderPaletteList()
  $('palette-input').focus()
}
function closePalette() {
  paletteOpen = false
  $('palette')?.classList.add('hidden')
}

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen ? closePalette() : openPalette()
  } else if (e.key === 'Escape' && paletteOpen) {
    closePalette()
  }
})

// Model picker entries join the palette once app.js has loaded the catalog.
export function extendPaletteModels(models) {
  for (const m of models ?? []) {
    if (m.id === 'auto') continue
    if (COMMANDS.some((c) => c.id === 'model:' + m.id)) continue
    COMMANDS.push({
      id: 'model:' + m.id,
      label: `Switch to ${m.label ?? m.id}`,
      hint: 'model',
      run: () => window.__portalPickModel?.(m.id),
    })
  }
}

console.info('[portal] beautiful primitives loaded — ⌘K for commands')

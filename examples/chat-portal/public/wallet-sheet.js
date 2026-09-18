// Wallet Sheet — the connect-wallet moment, designed to delight.
// One elegant primary button opens a sheet: wallets as cards with icon,
// name, one-line promise, and a "why this" whisper. Spring-eased entrance,
// staggered card reveal, scrim blur, fluid dismiss (click-out, Esc, X).
// The actual connect logic stays in app.js — this only owns the moment.
const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' })[c])

const WALLETS = [
  {
    id: 'paybox',
    icon: '◈',
    name: 'Paybox',
    promise: 'Shipyard\'s USDC smart account',
    whisper: 'Passkey login, instant signing with an agent key, funds each request within your grant.',
    badge: 'recommended',
  },
  {
    id: 'phantom',
    icon: '◇',
    name: 'Phantom',
    promise: 'Your existing Solana wallet',
    whisper: 'Non-custodial — you approve every channel open in the wallet extension.',
    badge: null,
  },
]

let sheetOpen = false

export function initWalletSheet() {
  const openBtn = $('connect-open')
  if (!openBtn) return
  openBtn.addEventListener('click', openSheet)
}

function buildSheet() {
  if ($('wallet-sheet')) return
  const el = document.createElement('div')
  el.id = 'wallet-sheet'
  el.className = 'wsheet'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'Connect a wallet')
  el.innerHTML = `
    <div class="wsheet-scrim" data-close></div>
    <div class="wsheet-card">
      <div class="wsheet-head">
        <div>
          <div class="wsheet-title">Connect a wallet</div>
          <div class="wsheet-sub">Fund inference per request — metered to the token, settled in USDC.</div>
        </div>
        <button class="wsheet-x" data-close aria-label="Close">✕</button>
      </div>
      <div class="wsheet-list">
        ${WALLETS.map(
          (w, i) => `
          <button class="wsheet-wallet" data-wallet="${w.id}" style="--i:${i}">
            <span class="wsheet-icon">${w.icon}</span>
            <span class="wsheet-main">
              <span class="wsheet-name-row">
                <span class="wsheet-name">${esc(w.name)}</span>
                ${w.badge ? `<span class="wsheet-badge">${esc(w.badge)}</span>` : ''}
              </span>
              <span class="wsheet-promise">${esc(w.promise)}</span>
              <span class="wsheet-whisper">${esc(w.whisper)}</span>
            </span>
            <span class="wsheet-go">→</span>
          </button>`,
        ).join('')}
      </div>
      <div class="wsheet-foot">Settles on Solana · your keys never leave your wallet</div>
    </div>`
  document.body.appendChild(el)

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      closeSheet()
      return
    }
    const card = e.target.closest('.wsheet-wallet')
    if (card) {
      // hand off to app.js's existing connect flow, then close the moment
      closeSheet()
      document.dispatchEvent(new CustomEvent('portal:connect-wallet', { detail: card.dataset.wallet }))
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) closeSheet()
  })
}

function openSheet() {
  buildSheet()
  const el = $('wallet-sheet')
  sheetOpen = true
  el.classList.remove('closing')
  el.classList.add('open')
}

function closeSheet() {
  const el = $('wallet-sheet')
  if (!el || !sheetOpen) return
  sheetOpen = false
  el.classList.add('closing')
  el.classList.remove('open')
  // keep the node so re-opens don't rebuild; just hide after the animation
  setTimeout(() => el.classList.remove('closing'), 240)
}

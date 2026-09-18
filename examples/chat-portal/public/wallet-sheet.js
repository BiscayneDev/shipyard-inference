// Wallet Sheet — the connect-wallet moment, designed to delight.
// Two steps, one sheet:
//   Step 1: Paybox, front and center (the recommended rail), plus a quiet
//           "Other wallets" chip beneath it.
//   Step 2: The ecosystem — Phantom, MetaMask, Solflare, Backpack, Ledger —
//           each card explaining what it is and whether it's detected.
// Spring-eased entrance, staggered card reveal, scrim blur, fluid step
// transition (shared-axis slide), dismiss from scrim/Esc/X.
// The actual connect logic stays in app.js — this only owns the moment.
const $ = (id) => document.getElementById(id)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&#38;', '<': '&#60;', '>': '&#62;', '"': '&#34;', "'": '&#39;' })[c])

const PAYBOX = {
  id: 'paybox',
  logo: './brands/paybox-app-icon.svg',
  logoDark: true,
  name: 'Paybox',
  promise: 'Shipyard\'s USDC smart account',
  whisper: 'Passkey login, instant signing with an agent key, funds each request within your grant.',
  badge: 'recommended',
}

const OTHER_WALLETS = [
  {
    id: 'phantom',
    logo: './brands/phantom-ghost.svg',
    name: 'Phantom',
    promise: 'The most popular Solana wallet',
    whisper: 'Non-custodial — you approve every channel open in the wallet extension.',
    detect: () => (window.phantom?.solana ? 'detected' : null),
  },
  {
    id: 'metamask',
    logo: './brands/metamask-fox.svg',
    name: 'MetaMask',
    promise: 'EVM wallet — Ethereum & friends',
    whisper: 'This rail settles USDC on Solana; MetaMask support is on the roadmap.',
    detect: () => (window.ethereum?.isMetaMask ? 'detected' : null),
  },
  {
    id: 'solflare',
    logo: './brands/solflare.svg',
    name: 'Solflare',
    promise: 'Solana web + extension wallet',
    whisper: 'Coming soon to this portal — the Solana rail is already live.',
    detect: () => (window.solflare ? 'detected' : null),
    soon: true,
  },
  {
    id: 'backpack',
    logo: './brands/backpack.svg',
    name: 'Backpack',
    promise: 'xNFT wallet by the Mad Lads crew',
    whisper: 'Coming soon to this portal — the Solana rail is already live.',
    detect: () => (window.backpack ? 'detected' : null),
    soon: true,
  },
  {
    id: 'ledger',
    logo: './brands/ledger.svg',
    name: 'Ledger',
    promise: 'Hardware wallet — cold storage',
    whisper: 'Coming soon — pair via a Solana connector.',
    detect: () => null,
    soon: true,
  },
]

let sheetOpen = false
let step = 1

export function initWalletSheet() {
  const openBtn = $('connect-open')
  if (!openBtn) return
  openBtn.addEventListener('click', openSheet)
}

/** Open the connect-wallet sheet programmatically (e.g. from an inline
 *  "connect a wallet" error action). Safe to call repeatedly. */
export function openWalletSheet() {
  openSheet()
}

function walletCard(w, i, opts = {}) {
  const detected = w.detect?.()
  const stateChip = opts.showState
    ? detected
      ? `<span class="wsheet-state on">detected</span>`
      : w.soon
        ? `<span class="wsheet-state">soon</span>`
        : ''
    : ''
  return `
    <button class="wsheet-wallet${w.soon ? ' soon' : ''}" data-wallet="${w.id}" style="--i:${i}">
      <span class="wsheet-icon${w.logoDark ? ' light-tile' : ''}">
        ${w.logo ? `<img class="wsheet-logo" src="${w.logo}" alt="${esc(w.name)} logo" draggable="false" />` : ''}
      </span>
      <span class="wsheet-main">
        <span class="wsheet-name-row">
          <span class="wsheet-name">${esc(w.name)}</span>
          ${w.badge ? `<span class="wsheet-badge">${esc(w.badge)}</span>` : ''}
          ${stateChip}
        </span>
        <span class="wsheet-promise">${esc(w.promise)}</span>
        <span class="wsheet-whisper">${esc(w.whisper)}</span>
      </span>
      <span class="wsheet-go">${w.soon ? '·' : '→'}</span>
    </button>`
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
        <div class="wsheet-head-inner">
          <button class="wsheet-back hidden" id="wsheet-back" aria-label="Back">←</button>
          <div>
            <div class="wsheet-title" id="wsheet-title">Connect a wallet</div>
            <div class="wsheet-sub" id="wsheet-sub">Fund inference per request — metered to the token, settled in USDC.</div>
          </div>
        </div>
        <button class="wsheet-x" data-close aria-label="Close">✕</button>
      </div>

      <div class="wsheet-panes">
        <div class="wsheet-pane" id="wsheet-pane-1">
          <div class="wsheet-list">
            ${walletCard(PAYBOX, 0)}
          </div>
          <button class="wsheet-other" id="wsheet-other" style="--i:1">
            <span class="wsheet-other-icon">
              <img src="./brands/phantom-ghost.svg" alt="" draggable="false" />
              <img src="./brands/metamask-fox.svg" alt="" draggable="false" />
              <img src="./brands/solflare.svg" alt="" draggable="false" />
            </span>
            <span class="wsheet-main">
              <span class="wsheet-name-row"><span class="wsheet-name">Other wallets</span></span>
              <span class="wsheet-promise">Phantom, MetaMask, Solflare, Backpack, Ledger…</span>
            </span>
            <span class="wsheet-go">→</span>
          </button>
        </div>

        <div class="wsheet-pane" id="wsheet-pane-2" hidden>
          <div class="wsheet-list wsheet-list-tall">
            ${OTHER_WALLETS.map((w, i) => walletCard(w, i, { showState: true })).join('')}
          </div>
        </div>
      </div>

      <div class="wsheet-foot">Settles on Solana · your keys never leave your wallet</div>
    </div>`
  document.body.appendChild(el)

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      closeSheet()
      return
    }
    if (e.target.closest('#wsheet-other')) {
      gotoStep(2)
      return
    }
    if (e.target.closest('#wsheet-back')) {
      gotoStep(1)
      return
    }
    const card = e.target.closest('.wsheet-wallet')
    if (card) {
      if (card.classList.contains('soon')) {
        // soft feedback: the card breathes; the whisper already explains.
        card.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
          { duration: 220, easing: 'ease-out' },
        )
        return
      }
      closeSheet()
      document.dispatchEvent(new CustomEvent('portal:connect-wallet', { detail: card.dataset.wallet }))
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen) closeSheet()
  })
}

/** Fluid step transition — shared-axis slide: out toward the side, in from the other. */
function gotoStep(n) {
  const panes = [$('wsheet-pane-1'), $('wsheet-pane-2')]
  const back = $('wsheet-back')
  const title = $('wsheet-title')
  const sub = $('wsheet-sub')
  const dir = n === 2 ? 1 : -1
  const [fromPane, toPane] = n === 2 ? [panes[0], panes[1]] : [panes[1], panes[0]]

  toPane.hidden = false
  fromPane.animate(
    [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-28 * dir}px)`, opacity: 0 }],
    { duration: 200, easing: 'ease-out', fill: 'forwards' },
  )
  toPane.animate(
    [{ transform: `translateX(${28 * dir}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
    { duration: 260, easing: 'cubic-bezier(.3, 1, .4, 1)' },
  )
  setTimeout(() => {
    fromPane.hidden = true
  }, 210)

  back.classList.toggle('hidden', n === 1)
  title.textContent = n === 2 ? 'Other wallets' : 'Connect a wallet'
  sub.textContent =
    n === 2
      ? 'Bring the wallet you already have — detected wallets are ready.'
      : 'Fund inference per request — metered to the token, settled in USDC.'
  step = n
  // Restagger the incoming pane's cards.
  for (const card of toPane.querySelectorAll('.wsheet-wallet, .wsheet-other')) {
    card.style.animation = 'none'
    void card.offsetWidth
    card.style.animation = ''
  }
}

function openSheet() {
  buildSheet()
  const el = $('wallet-sheet')
  sheetOpen = true
  // always open on step 1 (Paybox front and center)
  if (step !== 1) gotoStep(1)
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

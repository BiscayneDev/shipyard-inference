// Shipyard Inference — public model catalog (vanilla, no build step).
'use strict'

const $ = (id) => document.getElementById(id)

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))

const FIT_LABEL = {
  'runs-on-8gb': 'runs on 8GB M2',
  'needs-32gb': 'needs 32GB',
  'needs-64gb': 'needs 64GB',
  'cloud-only': 'cloud only',
}

function fmtPrice(entry) {
  if (entry.localAvailable) return '<span class="pos">free (local)</span>'
  const fmt = (n) =>
    '$' + (n < 1 ? n.toFixed(2).replace(/0$/, '') : n.toLocaleString(undefined, { maximumFractionDigits: 2 }))
  return fmt(entry.inputPerMTok) + ' in · ' + fmt(entry.outputPerMTok) + ' out <span class="muted">/1M tok</span>'
}

function render(body) {
  const models = body.models || []
  $('catalog-sub').textContent = models.length + ' models'
  if (!models.length) {
    $('catalog').innerHTML = '<div class="empty">Catalog unavailable.</div>'
    return
  }
  const head = '<tr><th>Model</th><th>Provider</th><th>Price</th><th>Context</th><th>Hardware fit</th><th>Local</th></tr>'
  const rows = models
    .map(
      (m) => `<tr>
    <td class="mono">${esc(m.slug)}</td>
    <td>${esc(m.provider)}</td>
    <td>${fmtPrice(m)}</td>
    <td>${Number(m.context).toLocaleString()} tok</td>
    <td>${esc(FIT_LABEL[m.hardwareFit] || m.hardwareFit)}</td>
    <td class="${m.localAvailable ? 'pos' : 'muted'}">${m.localAvailable ? 'yes' : 'no'}</td>
  </tr>`,
    )
    .join('')
  $('catalog').innerHTML = `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`
}

fetch('/api/catalog')
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then(render)
  .catch(() => {
    $('catalog').innerHTML =
      '<div class="empty">Catalog API unavailable — the operator token gate may be on. <a href="/dashboard">Open the dashboard</a> to unlock.</div>'
  })

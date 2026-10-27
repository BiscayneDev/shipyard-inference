// Redacted, dependency-free tripwire. Not a complete secret scanner.
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
export function credentialRules(path, text) {
  const rules = []
  if (/(^|\/)\.data\//.test(path) || /(^|\/)(sessions|paybox-clients)\.json$/.test(path)) rules.push('runtime-state-path')
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(text)) rules.push('private-key')
  // A syntactically JWT-like literal is unsafe to commit, even if expired.
  if (/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text)) rules.push('jwt-literal')
  if (/["'](?:accessToken|refreshToken|access_token|refresh_token)["']\s*:\s*["'][A-Za-z0-9_+\/.=-]{32,}["']/.test(text)) rules.push('oauth-token-literal')
  if (/\b(?:ghp_|github_pat_|pbx_live_)[A-Za-z0-9_]{24,}/.test(text)) rules.push('service-token-literal')
  return rules
}
export function scanTracked({ staged = false } = {}) {
  // Read Git blobs, not working copies: a staged secret cannot hide behind a
  // later edit, and a tracked symlink is inspected as a link rather than followed.
  const names = execFileSync('git', staged ? ['diff','--cached','--name-only','--diff-filter=ACMR','-z'] : ['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
  const findings=[]
  for (const path of names) {
    const bytes=execFileSync('git',['show',`:${path}`],{maxBuffer:64*1024*1024})
    if (bytes.includes(0)) continue // binary scanning is outside this tripwire
    for (const rule of credentialRules(path, bytes.toString('utf8'))) findings.push({path,rule})
  }
  return findings
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const findings=scanTracked({staged:process.argv.includes('--staged')})
    if (findings.length) {
      // Never emit matched lines, values, credential fragments or file content.
      for (const {path,rule} of findings) console.error(JSON.stringify({path,rule}))
      process.exitCode=1
    } else console.log('Credential tripwire: no matching tracked text blobs')
  } catch {
    console.error('Credential tripwire failed to inspect Git blobs; refusing success')
    process.exitCode=2
  }
}

import { Hono } from 'hono'
import { checkBearer } from './auth.js'
import type { ApiKeyStore } from './keys.js'

export const INFERENCE_SCOPES = ['models:read', 'chat:write', 'messages:write', 'tokens:count'] as const

/** Scoped keys are allowlisted. Legacy keys without scopes keep their behavior. */
export function scopeForEndpoint(method: string, path: string): string | undefined {
  return ({
    'GET /v1/models': 'models:read',
    'POST /v1/chat/completions': 'chat:write',
    'POST /v1/messages': 'messages:write',
    'POST /v1/messages/count_tokens': 'tokens:count',
  } as Record<string, string>)[`${method} ${path}`]
}

/** Mount before the general operator API. Never opens anonymous self-serve. */
export function createOwnerKeyApp(opts: { operatorTokens: string[]; keyStore: ApiKeyStore; caps: Record<string, number> }) {
  const app = new Hono()
  app.post('/api/owner/keys', async (c) => {
    if (!opts.operatorTokens.length || !checkBearer(opts.operatorTokens, c.req.header('authorization'))) {
      return c.json({ error: 'Invalid operator token' }, 401)
    }
    let body: Record<string, unknown>
    try {
      const parsed: unknown = await c.req.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required')
      body = parsed as Record<string, unknown>
    } catch { return c.json({ error: 'Expected a JSON object' }, 400) }
    const projectId = body.projectId
    if (typeof projectId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(projectId)) {
      return c.json({ error: 'A projectId of 1-64 letters, digits, underscores or hyphens is required' }, 400)
    }
    const capUsd = Object.hasOwn(opts.caps, projectId) ? opts.caps[projectId] : undefined
    if (typeof capUsd !== 'number' || !Number.isFinite(capUsd) || capUsd < 0) {
      return c.json({ error: 'Configure this project in SHIPYARD_PROJECT_CAPS before issuing a key' }, 409)
    }
    const scopes = body.scopes
    if (!Array.isArray(scopes) || !scopes.length || scopes.some(s => typeof s !== 'string' || !INFERENCE_SCOPES.includes(s as typeof INFERENCE_SCOPES[number]))) {
      return c.json({ error: 'scopes must be a nonempty array of supported inference scopes', supportedScopes: INFERENCE_SCOPES }, 400)
    }
    if (body.label !== undefined && (typeof body.label !== 'string' || !body.label.trim() || body.label.length > 64)) {
      return c.json({ error: 'label must be a nonempty string of at most 64 characters' }, 400)
    }
    // Only these fields cross the trust boundary. No model/provider pins or cap overrides.
    const issued = await opts.keyStore.issue({ projectId, scopes: [...new Set(scopes)] as string[], label: body.label as string | undefined }, Date.now())
    c.header('Cache-Control', 'no-store')
    return c.json({ ...issued, capUsd, resets: '00:00 UTC' }, 201)
  })
  app.get('/owner/keys', c => c.html(OWNER_KEYS_HTML))
  return app
}

const OWNER_KEYS_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Owner keys · Shipyard</title><style>body{font:16px system-ui;background:#081221;color:#eee;max-width:640px;margin:48px auto;padding:24px}label{display:block;margin:20px 0}input,button,textarea{font:inherit;padding:10px;width:100%;box-sizing:border-box}button{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Owner-issued inference key</h1><p>Self-serve stays closed. Configure the project's daily cap before issuing. No model or provider pinning.</p><form id="form"><label>Operator token<input id="token" type="password" autocomplete="off" required></label><label>Project ID<input id="project" placeholder="buoy-credits" required pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}"></label><label>Label<input id="label" maxlength="64" required></label><p>Scopes: models:read, chat:write, messages:write, tokens:count. Video and decisions are excluded.</p><button>Issue capped key</button></form><pre id="status" role="status"></pre><label id="fresh" hidden>New key (shown once, store securely)<input id="key" type="password" readonly autocomplete="off"></label><script>document.getElementById('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;document.getElementById('fresh').hidden=true;document.getElementById('key').value='';try{const r=await fetch('/api/owner/keys',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+document.getElementById('token').value},body:JSON.stringify({projectId:document.getElementById('project').value,label:document.getElementById('label').value,scopes:['models:read','chat:write','messages:write','tokens:count']})});const d=await r.json();if(!r.ok)throw Error(d.error||'Issuance failed');document.getElementById('key').value=d.key;document.getElementById('fresh').hidden=false;document.getElementById('status').textContent='Issued for '+d.account.projectId+'; $'+d.capUsd+'/day, resets '+d.resets+'. Stored scopes: '+d.account.scopes.join(', ');document.getElementById('token').value=''}catch(err){document.getElementById('status').textContent=err.message}finally{b.disabled=false}}</script></body></html>`

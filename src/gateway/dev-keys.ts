/**
 * Developer self-serve key management.
 *
 * Holding an active key is the developer's identity: from it they can list the
 * keys in their project (masked), create more, relabel, and revoke. A
 * developer's first key (from /connect or /keys) anchors their project; every
 * key created from it joins that project. No accounts or passwords yet: this
 * is the smallest version that makes getting and managing keys easy. Wallet
 * sign-in can replace "paste a key" later without changing the data model.
 *
 * Framework-free: each handler returns `{ status, body }` for the host route.
 */
import {
  effectiveProjectId,
  maskKey,
  newKeyUserId,
  type Account,
  type ApiKeyStore,
} from './keys.js'

/** Most active keys one project may hold at once. */
export const MAX_ACTIVE_KEYS_PER_PROJECT = 20
const LABEL_MAX = 64

export interface DevKeyView {
  id: string
  label: string | null
  masked: string
  status: 'active' | 'revoked'
  createdAt: number
  revokedAt: number | null
  /** True for the key making this request. */
  current: boolean
}

export interface DevKeyResult {
  status: number
  body: Record<string, unknown>
}

function view(a: Account, caller: Account): DevKeyView {
  return {
    id: a.keyId ?? '',
    label: a.label ?? null,
    masked: maskKey(a),
    status: a.status,
    createdAt: a.createdAt,
    revokedAt: a.revokedAt ?? null,
    current: Boolean(a.keyId && a.keyId === caller.keyId),
  }
}

function cleanLabel(raw: unknown): string | undefined | null {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return undefined
  return t.slice(0, LABEL_MAX)
}

function unsupported(): DevKeyResult {
  return { status: 501, body: { error: 'key management is not available on this deployment' } }
}

/** List the caller's project keys, newest first. */
export async function listDevKeys(store: ApiKeyStore, caller: Account): Promise<DevKeyResult> {
  if (!store.listProject) return unsupported()
  const projectId = effectiveProjectId(caller)
  const keys = (await store.listProject(projectId)).map((a) => view(a, caller))
  return {
    status: 200,
    body: {
      projectId,
      keys,
      activeCount: keys.filter((k) => k.status === 'active').length,
      maxActive: MAX_ACTIVE_KEYS_PER_PROJECT,
    },
  }
}

/** Create another key in the caller's project. Plaintext is returned once. */
export async function createDevKey(
  store: ApiKeyStore,
  caller: Account,
  input: { label?: unknown },
  at = Date.now(),
): Promise<DevKeyResult> {
  if (!store.listProject) return unsupported()
  const label = cleanLabel(input.label)
  if (label === null) return { status: 400, body: { error: '`label` must be a string' } }
  const projectId = effectiveProjectId(caller)
  const existing = await store.listProject(projectId)
  if (existing.filter((a) => a.status === 'active').length >= MAX_ACTIVE_KEYS_PER_PROJECT) {
    return {
      status: 409,
      body: { error: `This project already has ${MAX_ACTIVE_KEYS_PER_PROJECT} active keys. Revoke one to create another.` },
    }
  }
  const { key, account } = await store.issue(
    {
      userId: newKeyUserId(),
      projectId,
      tenantId: caller.tenantId,
      wallet: caller.wallet,
      label,
    },
    at,
  )
  return { status: 201, body: { key, ...view(account, caller), projectId } }
}

/** Soft-revoke a key in the caller's project (reversible in the database). */
export async function revokeDevKey(store: ApiKeyStore, caller: Account, keyId: string, at = Date.now()): Promise<DevKeyResult> {
  if (!store.revokeInProject) return unsupported()
  const ok = await store.revokeInProject(effectiveProjectId(caller), keyId, at)
  if (!ok) return { status: 404, body: { error: 'key not found in your project (or already revoked)' } }
  return { status: 200, body: { revoked: true, id: keyId, self: keyId === caller.keyId } }
}

/** Rename a key in the caller's project. */
export async function relabelDevKey(store: ApiKeyStore, caller: Account, keyId: string, input: { label?: unknown }): Promise<DevKeyResult> {
  if (!store.relabelInProject) return unsupported()
  const label = cleanLabel(input.label)
  if (label === null || label === undefined) return { status: 400, body: { error: '`label` is required' } }
  const ok = await store.relabelInProject(effectiveProjectId(caller), keyId, label)
  if (!ok) return { status: 404, body: { error: 'key not found in your project' } }
  return { status: 200, body: { id: keyId, label } }
}

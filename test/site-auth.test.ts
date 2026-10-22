import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedEmail, parseAllowlist } from '../src/site-auth/allow.ts'
import { siteAuthConfig } from '../src/site-auth/routes.ts'

test('site sign-in allowlist fails closed when unset or empty', () => {
  assert.equal(isAllowedEmail('owner@example.com', undefined), false)
  assert.equal(isAllowedEmail('owner@example.com', ''), false)
  assert.equal(isAllowedEmail('owner@example.com', ' , '), false)
})

test('site sign-in allowlist matches case-insensitively and rejects everyone else', () => {
  const list = 'Owner@Example.com, ops@example.com'
  assert.equal(isAllowedEmail('owner@example.com', list), true)
  assert.equal(isAllowedEmail('  OPS@example.com ', list), true)
  assert.equal(isAllowedEmail('stranger@example.com', list), false)
  assert.equal(isAllowedEmail(null, list), false)
})

test('site sign-in allowlist ignores entries that are not addresses', () => {
  assert.deepEqual(parseAllowlist('not-an-email, owner@example.com'), ['owner@example.com'])
})

test('site sign-in is not configured until URL, anon key and allowlist are all set', () => {
  assert.equal(siteAuthConfig({}).configured, false)
  assert.equal(siteAuthConfig({ SHIPYARD_SITE_SUPABASE_URL: 'https://x.supabase.co', SHIPYARD_SITE_SUPABASE_ANON_KEY: 'k' }).configured, false)
  assert.equal(
    siteAuthConfig({
      SHIPYARD_SITE_SUPABASE_URL: 'https://x.supabase.co',
      SHIPYARD_SITE_SUPABASE_ANON_KEY: 'k',
      SHIPYARD_SITE_ALLOWED_EMAILS: 'owner@example.com',
    }).configured,
    true,
  )
})

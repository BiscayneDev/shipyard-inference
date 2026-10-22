import { sha256hex, OAUTH_CLIENTS } from '../src/gateway/oauth.js'

export const TEST_CLIENT_SECRET = 'dock-test-client-secret-0123456789abcdef'
export const TEST_CLIENTS = { dock: { ...OAUTH_CLIENTS.dock!, secretSha256: sha256hex(TEST_CLIENT_SECRET) } }

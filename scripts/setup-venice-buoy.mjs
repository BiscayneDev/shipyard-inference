/**
 * setup-venice-buoy.mjs
 *
 * Registers Venice's video API as a Buoy x402 pay-per-call proxy.
 *
 * Buoy (https://openshipyard.xyz/buoy) wraps any upstream API with x402
 * payment gating — agents pay in USDC on Solana per call, Buoy verifies
 * the payment cryptographically, then forwards the request to the upstream.
 *
 * This script:
 *   1. Creates a Buoy x402 proxy config for Venice's API.
 *   2. Scans the upstream for OpenAPI endpoints.
 *   3. Sets per-endpoint pricing for the four Venice video routes.
 *
 * Prerequisites:
 *   - BUOY_API_KEY  — your Buoy/Shipyard API key (sk_live_...)
 *   - BUOY_BASE_URL — optional, defaults to https://openshipyard.xyz
 *   - VENICE_WALLET — your Solana wallet address for receiving USDC
 *
 * Usage:
 *   BUOY_API_KEY=sk_live_... VENICE_WALLET=<solana-wallet> node scripts/setup-venice-buoy.mjs
 *
 * Or with a custom Buoy host:
 *   BUOY_BASE_URL=https://staging.openshipyard.xyz BUOY_API_KEY=... VENICE_WALLET=... node scripts/setup-venice-buoy.mjs
 */

const BUOY_BASE_URL = process.env.BUOY_BASE_URL || 'https://openshipyard.xyz';
const BUOY_API_KEY = process.env.BUOY_API_KEY;
const VENICE_WALLET = process.env.VENICE_WALLET;

const VENICE_UPSTREAM = 'https://api.venice.ai/api/v1';

/** Per-endpoint pricing in USDC. Free endpoints (quote, retrieve, complete)
 *  are set to 0 so agents can poll status and fetch prices without paying. */
const ENDPOINT_PRICING = {
  '/video/queue': 1.00,    // primary generation call — billed
  '/video/quote': 0.00,    // price check — free
  '/video/retrieve': 0.00, // poll for result — free
  '/video/complete': 0.00, // cleanup — free
};

if (!BUOY_API_KEY) {
  console.error('✗ Missing BUOY_API_KEY environment variable (expected sk_live_...)');
  process.exit(1);
}
if (!VENICE_WALLET) {
  console.error('✗ Missing VENICE_WALLET environment variable (expected a Solana wallet address)');
  process.exit(1);
}

/** Minimal fetch wrapper with JSON helpers and Bearer auth. */
async function buoyFetch(path, { method = 'GET', body } = {}) {
  const url = `${BUOY_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${BUOY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    console.error(`✗ ${method} ${path} → ${res.status}`, json);
    throw new Error(`Buoy API error ${res.status} on ${method} ${path}`);
  }
  return json;
}

/** Step 1 — Create the x402 proxy config for Venice's API. */
async function setupProxy() {
  console.log('\n▸ Step 1: Creating x402 proxy for Venice API …');
  const result = await buoyFetch('/api/v1/x402/setup', {
    method: 'POST',
    body: {
      upstream_base_url: VENICE_UPSTREAM,
      wallet_address: VENICE_WALLET,
      default_price_usdc: 1.00,
    },
  });
  const listingId = result.listing_id || result.id;
  console.log(`  ✓ Proxy created — listing ID: ${listingId}`);
  if (result.proxy_url) console.log(`  ✓ Proxy URL: ${result.proxy_url}`);
  return listingId;
}

/** Step 2 — Scan the upstream for OpenAPI endpoints. */
async function scanEndpoints(listingId) {
  console.log('\n▸ Step 2: Scoping Venice endpoints via OpenAPI scan …');
  const result = await buoyFetch('/api/v1/x402/scan', {
    method: 'POST',
    body: {
      listing_id: listingId,
      upstream_base_url: VENICE_UPSTREAM,
    },
  });
  const endpoints = result.endpoints || result.scanned_endpoints || [];
  console.log(`  ✓ Scan complete — ${endpoints.length || 'N'} endpoints detected`);
  if (Array.isArray(endpoints)) {
    for (const ep of endpoints) {
      const path = ep.path || ep.endpoint || ep.url || '';
      if (path.includes('/video')) {
        console.log(`    · ${path}`);
      }
    }
  }
  return endpoints;
}

/** Step 3 — Set per-endpoint pricing for the Venice video routes. */
async function setPricing(listingId) {
  console.log('\n▸ Step 3: Setting per-endpoint pricing …');
  for (const [endpoint, price] of Object.entries(ENDPOINT_PRICING)) {
    const label = price === 0 ? 'free' : `$${price.toFixed(2)}`;
    console.log(`  · ${endpoint} → ${label}`);
  }
  await buoyFetch(`/api/v1/x402/${listingId}/pricing`, {
    method: 'PUT',
    body: {
      endpoint_pricing: Object.entries(ENDPOINT_PRICING).map(
        ([endpoint, price_usdc]) => ({ endpoint, price_usdc }),
      ),
    },
  });
  console.log('  ✓ Pricing updated for all Venice video endpoints');
}

/** Step 4 — Verify the final config. */
async function verifyConfig(listingId) {
  console.log('\n▸ Step 4: Verifying configuration …');
  const config = await buoyFetch(`/api/v1/x402/${listingId}`);
  console.log(`  ✓ Config confirmed — upstream: ${config.upstream_base_url || VENICE_UPSTREAM}`);
  if (config.proxy_url) console.log(`  ✓ Proxy live at: ${config.proxy_url}`);
  console.log('\n  Endpoint pricing:');
  const pricing = config.endpoint_pricing || config.pricing || {};
  for (const [endpoint, price] of Object.entries(ENDPOINT_PRICING)) {
    const actual = pricing[endpoint];
    if (actual !== undefined) {
      const p = typeof actual === 'number' ? `$${actual.toFixed(2)}` : actual;
      console.log(`    ${endpoint}: ${p}`);
    } else {
      console.log(`    ${endpoint}: $${price.toFixed(2)} (default)`);
    }
  }
  return config;
}

// ── main ──────────────────────────────────────────────────────────────
try {
  console.log('╭──────────────────────────────────────────────────────╮');
  console.log('│  Venice → Buoy x402 proxy setup                      │');
  console.log('╰──────────────────────────────────────────────────────╯');
  console.log(`  Buoy host:    ${BUOY_BASE_URL}`);
  console.log(`  Upstream:    ${VENICE_UPSTREAM}`);
  console.log(`  Wallet:      ${VENICE_WALLET.slice(0, 6)}…${VENICE_WALLET.slice(-4)}`);

  const listingId = await setupProxy();
  await scanEndpoints(listingId);
  await setPricing(listingId);
  await verifyConfig(listingId);

  console.log('\n✓ Done — Venice video endpoints are now live behind Buoy x402.\n');
  console.log('  Agents can call the proxy URL with an x402 payment header.');
  console.log('  /video/queue costs $1.00/call; /video/quote, /video/retrieve,');
  console.log('  and /video/complete are free.\n');
} catch (err) {
  console.error(`\n✗ Setup failed: ${err.message}`);
  process.exit(1);
}

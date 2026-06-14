// Binance private REST API request signer.
// Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api
//
// Signed endpoints require:
//   - X-MBX-APIKEY: <apiKey> header
//   - signature param = HMAC-SHA256(secret, queryString) hex
//   - timestamp param (ms)
//
// The "testnet" flag swaps the base URL to the Spot Testnet
// (https://testnet.binance.vision) which uses identical endpoints.

import crypto from 'node:crypto'

const MAINNET = 'https://api.binance.com'
const TESTNET = 'https://testnet.binance.vision'

export async function binanceSigned({
  apiKey, apiSecret, testnet, method = 'GET', path, params = {},
}) {
  const base = testnet ? TESTNET : MAINNET
  const allParams = { ...params, timestamp: Date.now(), recvWindow: 5000 }
  const qsBase = new URLSearchParams(allParams).toString()
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(qsBase)
    .digest('hex')
  const qs = `${qsBase}&signature=${signature}`

  const url = method === 'GET'
    ? `${base}${path}?${qs}`
    : `${base}${path}`

  const init = {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'User-Agent': 'trend-bot/1.0',
    },
    signal: AbortSignal.timeout(8000),
  }
  if (method !== 'GET') {
    init.body = qs
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  const r = await fetch(url, init)
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = data?.msg || `HTTP ${r.status}`
    throw new Error('Binance: ' + msg)
  }
  return data
}

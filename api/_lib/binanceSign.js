// Binance private REST API request signer.
// Ref: https://developers.binance.com/docs/binance-spot-api-docs/rest-api
//
// Signed endpoints require:
//   - X-MBX-APIKEY: <apiKey> header
//   - signature param
//   - timestamp param (ms)
//
// We support TWO key types automatically:
//   - HMAC-SHA256 (System Generated key, single-line secret) → hex signature
//   - Ed25519 / RSA (Self-Generated key, PEM private key)    → base64 signature
//
// Detection: if the secret contains BEGIN ... PRIVATE KEY it's a PEM.
//
// The "testnet" flag swaps the base URL to the Spot Testnet
// (https://testnet.binance.vision) which uses identical endpoints.

import crypto from 'node:crypto'

const MAINNET = 'https://api.binance.com'
const TESTNET = 'https://testnet.binance.vision'

function isPem(secret) {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(secret)
}

function signPayload(secret, payload) {
  if (isPem(secret)) {
    // Ed25519 or RSA — Node's crypto.sign auto-detects the algorithm
    // from the key. Ed25519 must use null digest. RSA uses default
    // PKCS#1 v1.5 which is what Binance expects.
    const privateKey = crypto.createPrivateKey({
      key: secret,
      format: 'pem',
    })
    const isEd25519 = privateKey.asymmetricKeyType === 'ed25519'
    const signature = crypto.sign(
      isEd25519 ? null : 'sha256',
      Buffer.from(payload, 'utf8'),
      privateKey
    )
    return signature.toString('base64')
  }
  // HMAC SHA256
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

export async function binanceSigned({
  apiKey, apiSecret, testnet, method = 'GET', path, params = {},
}) {
  const base = testnet ? TESTNET : MAINNET
  const allParams = { ...params, timestamp: Date.now(), recvWindow: 5000 }
  const qsBase = new URLSearchParams(allParams).toString()
  const signature = signPayload(apiSecret, qsBase)
  // base64 signatures contain +, /, = — must be URL-encoded.
  const qs = `${qsBase}&signature=${encodeURIComponent(signature)}`

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

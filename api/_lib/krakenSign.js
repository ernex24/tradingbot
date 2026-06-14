// Kraken private REST API request signer.
// Reference: https://docs.kraken.com/api/docs/rest-api/get-server-time
//
// Signature = base64( HMAC-SHA512(
//   base64_decode(secret),
//   uri_path + sha256(nonce + post_data)
// ))

import crypto from 'node:crypto'

export async function krakenPrivate(apiKey, apiSecret, endpoint, params = {}) {
  const path = `/0/private/${endpoint}`
  const nonce = Date.now().toString()
  const body = new URLSearchParams({ nonce, ...params }).toString()

  const sha256 = crypto.createHash('sha256')
    .update(nonce + body, 'utf8')
    .digest()

  const secretBytes = Buffer.from(apiSecret, 'base64')
  const message = Buffer.concat([Buffer.from(path, 'utf8'), sha256])
  const signature = crypto
    .createHmac('sha512', secretBytes)
    .update(message)
    .digest('base64')

  const r = await fetch(`https://api.kraken.com${path}`, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'trend-bot/1.0',
    },
    body,
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) {
    throw new Error(`Kraken HTTP ${r.status}`)
  }
  const data = await r.json()
  if (data.error && data.error.length) {
    throw new Error('Kraken: ' + data.error.join(', '))
  }
  return data.result
}

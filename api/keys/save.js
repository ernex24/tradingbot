// POST /api/keys/save
// Body: { exchange, testnet, apiKey, apiSecret, permissions: string[] }
// Requires Authorization: Bearer <Supabase JWT>.
// Validates the key by hitting the exchange's account endpoint before
// storing. Encrypts both fields with AES-256-GCM, upserts into
// user_exchange_keys keyed by (user_id, exchange, testnet).

import { encrypt } from '../_lib/encryption.js'
import { krakenPrivate } from '../_lib/krakenSign.js'
import { binanceSigned } from '../_lib/binanceSign.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }

  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const { exchange, testnet, apiKey, apiSecret, permissions } = req.body || {}
  if (!exchange || !apiKey || !apiSecret) {
    return jsonResponse(res, 400, { error: 'missing exchange, apiKey or apiSecret' })
  }
  if (!['kraken', 'binance'].includes(exchange)) {
    return jsonResponse(res, 400, { error: 'unsupported exchange' })
  }
  const isTestnet = !!testnet

  const trimmedKey = apiKey.trim()
  const trimmedSecret = apiSecret.trim()

  // Validate the key by making a real authenticated call before storing.
  try {
    if (exchange === 'kraken') {
      await krakenPrivate(trimmedKey, trimmedSecret, 'Balance')
    } else if (exchange === 'binance') {
      await binanceSigned({
        apiKey: trimmedKey,
        apiSecret: trimmedSecret,
        testnet: isTestnet,
        path: '/api/v3/account',
      })
    }
  } catch (e) {
    return jsonResponse(res, 400, { error: 'key validation failed: ' + e.message })
  }

  const keyHint = trimmedKey.slice(-4)
  const apiKeyEnc = encrypt(trimmedKey)
  const apiSecretEnc = encrypt(trimmedSecret)

  const admin = getAdminClient()
  const { error } = await admin
    .from('user_exchange_keys')
    .upsert({
      user_id: user.user_id,
      exchange,
      testnet: isTestnet,
      api_key_encrypted: apiKeyEnc,
      api_secret_encrypted: apiSecretEnc,
      key_hint: keyHint,
      permissions: Array.isArray(permissions) ? permissions : [],
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'user_id,exchange,testnet' })

  if (error) {
    console.error('keys/save db error:', error)
    return jsonResponse(res, 500, { error: 'failed to store key' })
  }

  return jsonResponse(res, 200, {
    saved: true,
    exchange,
    testnet: isTestnet,
    keyHint,
  })
}

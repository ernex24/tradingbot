// Consolidated keys endpoint: /api/keys/save, /api/keys/status,
// /api/keys/delete. Single Vercel function file.

import { encrypt } from '../_lib/encryption.js'
import { binanceSigned } from '../_lib/binanceSign.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

async function save(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { exchange, testnet, apiKey, apiSecret, permissions } = req.body || {}
  if (!exchange || !apiKey || !apiSecret) {
    return jsonResponse(res, 400, { error: 'missing exchange, apiKey or apiSecret' })
  }
  if (exchange !== 'binance') {
    return jsonResponse(res, 400, { error: 'only Binance is supported' })
  }
  const isTestnet = !!testnet
  const trimmedKey = apiKey.trim()
  const trimmedSecret = apiSecret.trim()
  try {
    await binanceSigned({
      apiKey: trimmedKey,
      apiSecret: trimmedSecret,
      testnet: isTestnet,
      path: '/api/v3/account',
    })
  } catch (e) {
    return jsonResponse(res, 400, { error: 'key validation failed: ' + e.message })
  }
  const keyHint = trimmedKey.slice(-4)
  const apiKeyEnc = encrypt(trimmedKey)
  const apiSecretEnc = encrypt(trimmedSecret)
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
  return jsonResponse(res, 200, { saved: true, exchange, testnet: isTestnet, keyHint })
}

async function status(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { data, error } = await admin
    .from('user_exchange_keys')
    .select('exchange, testnet, key_hint, permissions, created_at, last_used_at')
    .eq('user_id', user.user_id)
  if (error) {
    console.error('keys/status db error:', error)
    return jsonResponse(res, 500, { error: 'failed to fetch status' })
  }
  return jsonResponse(res, 200, {
    keys: (data || []).map(row => ({
      exchange: row.exchange,
      testnet: !!row.testnet,
      keyHint: row.key_hint,
      permissions: row.permissions || [],
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    })),
  })
}

async function remove(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { exchange, testnet } = req.body || {}
  if (!exchange) return jsonResponse(res, 400, { error: 'missing exchange' })
  const { error } = await admin
    .from('user_exchange_keys')
    .delete()
    .eq('user_id', user.user_id)
    .eq('exchange', exchange)
    .eq('testnet', !!testnet)
  if (error) {
    console.error('keys/delete db error:', error)
    return jsonResponse(res, 500, { error: 'failed to delete' })
  }
  return jsonResponse(res, 200, { deleted: true, exchange, testnet: !!testnet })
}

export default async function handler(req, res) {
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }
  const admin = getAdminClient()
  const { action } = req.query
  if (action === 'save') return save(req, res, user, admin)
  if (action === 'status') return status(req, res, user, admin)
  if (action === 'delete') return remove(req, res, user, admin)
  return jsonResponse(res, 404, { error: 'action not found' })
}

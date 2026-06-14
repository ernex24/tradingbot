// GET /api/kraken/balance
// Requires Authorization: Bearer <Supabase JWT>.
// Fetches the user's stored Kraken key, decrypts, calls Kraken's private
// /0/private/Balance endpoint, returns the raw asset map plus a few
// computed totals.
//
// The plaintext key never leaves this function.

import { decrypt } from '../_lib/encryption.js'
import { krakenPrivate } from '../_lib/krakenSign.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }

  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const admin = getAdminClient()
  const { data: row, error: dbError } = await admin
    .from('user_exchange_keys')
    .select('api_key_encrypted, api_secret_encrypted')
    .eq('user_id', user.user_id)
    .eq('exchange', 'kraken')
    .maybeSingle()

  if (dbError) {
    console.error('kraken/balance db error:', dbError)
    return jsonResponse(res, 500, { error: 'failed to load key' })
  }
  if (!row) {
    return jsonResponse(res, 404, { error: 'no Kraken key configured' })
  }

  let apiKey, apiSecret
  try {
    apiKey = decrypt(row.api_key_encrypted)
    apiSecret = decrypt(row.api_secret_encrypted)
  } catch (e) {
    console.error('decrypt error:', e)
    return jsonResponse(res, 500, { error: 'failed to decrypt key' })
  }

  let raw
  try {
    raw = await krakenPrivate(apiKey, apiSecret, 'Balance')
  } catch (e) {
    return jsonResponse(res, 502, { error: e.message })
  }

  // Background-update last_used_at; don't block on it.
  admin
    .from('user_exchange_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', user.user_id)
    .eq('exchange', 'kraken')
    .then(() => {}, () => {})

  // Strip zero balances and normalize asset names (Kraken uses X/Z prefixes
  // for the legacy assets — XXBT, ZUSD etc.).
  const normalize = (code) => {
    if (code === 'XXBT') return 'BTC'
    if (code === 'XETH') return 'ETH'
    if (code === 'XXRP') return 'XRP'
    if (code === 'XLTC') return 'LTC'
    if (code === 'ZUSD') return 'USD'
    if (code === 'ZEUR') return 'EUR'
    return code
  }
  const balances = Object.entries(raw || {})
    .map(([asset, amt]) => ({ asset: normalize(asset), amount: +amt }))
    .filter(b => b.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  return jsonResponse(res, 200, { balances })
}

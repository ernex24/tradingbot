// GET /api/binance/balance?testnet=1
// Requires Authorization: Bearer <Supabase JWT>.
// Fetches the user's stored Binance key for the requested network,
// decrypts, calls Binance Spot's /api/v3/account, returns the asset
// balance map filtered to non-zero rows.

import { decrypt } from '../_lib/encryption.js'
import { binanceSigned } from '../_lib/binanceSign.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }

  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const testnet = req.query.testnet === '1' || req.query.testnet === 'true'

  const admin = getAdminClient()
  const { data: row, error: dbError } = await admin
    .from('user_exchange_keys')
    .select('api_key_encrypted, api_secret_encrypted')
    .eq('user_id', user.user_id)
    .eq('exchange', 'binance')
    .eq('testnet', testnet)
    .maybeSingle()

  if (dbError) {
    console.error('binance/balance db error:', dbError)
    return jsonResponse(res, 500, { error: 'failed to load key' })
  }
  if (!row) {
    return jsonResponse(res, 404, {
      error: `no Binance ${testnet ? 'Testnet' : ''} key configured`,
    })
  }

  let apiKey, apiSecret
  try {
    apiKey = decrypt(row.api_key_encrypted)
    apiSecret = decrypt(row.api_secret_encrypted)
  } catch (e) {
    console.error('decrypt error:', e)
    return jsonResponse(res, 500, { error: 'failed to decrypt key' })
  }

  let account
  try {
    account = await binanceSigned({
      apiKey, apiSecret, testnet,
      path: '/api/v3/account',
    })
  } catch (e) {
    return jsonResponse(res, 502, { error: e.message })
  }

  admin
    .from('user_exchange_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', user.user_id)
    .eq('exchange', 'binance')
    .eq('testnet', testnet)
    .then(() => {}, () => {})

  const balances = (account?.balances || [])
    .map(b => ({
      asset: b.asset,
      free: +b.free,
      locked: +b.locked,
      total: +b.free + +b.locked,
    }))
    .filter(b => b.total > 0)
    .sort((a, b) => b.total - a.total)

  return jsonResponse(res, 200, {
    testnet,
    canTrade: !!account?.canTrade,
    accountType: account?.accountType,
    permissions: account?.permissions || [],
    balances,
  })
}

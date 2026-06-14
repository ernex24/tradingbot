// GET /api/binance/orders?testnet=1[&symbol=BTCUSDT]
// Requires Authorization: Bearer <Supabase JWT>.
// Lists currently open orders. Without symbol, returns open orders
// across all symbols.

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
  const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : null

  const admin = getAdminClient()
  const { data: row } = await admin
    .from('user_exchange_keys')
    .select('api_key_encrypted, api_secret_encrypted')
    .eq('user_id', user.user_id)
    .eq('exchange', 'binance')
    .eq('testnet', testnet)
    .maybeSingle()

  if (!row) return jsonResponse(res, 404, { error: 'no Binance key configured' })

  let apiKey, apiSecret
  try {
    apiKey = decrypt(row.api_key_encrypted)
    apiSecret = decrypt(row.api_secret_encrypted)
  } catch {
    return jsonResponse(res, 500, { error: 'failed to decrypt key' })
  }

  try {
    const orders = await binanceSigned({
      apiKey, apiSecret, testnet,
      path: '/api/v3/openOrders',
      params: symbol ? { symbol } : {},
    })
    return jsonResponse(res, 200, {
      orders: (orders || []).map(o => ({
        orderId: o.orderId,
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        status: o.status,
        price: +o.price,
        origQty: +o.origQty,
        executedQty: +o.executedQty,
        time: o.time,
      })),
    })
  } catch (e) {
    return jsonResponse(res, 502, { error: e.message })
  }
}

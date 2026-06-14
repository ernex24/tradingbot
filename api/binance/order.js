// POST /api/binance/order
// Body: { testnet, symbol, side, type, quoteOrderQty?, quantity?, price? }
// Requires Authorization: Bearer <Supabase JWT>.
//
// Places a Spot order on Binance. For Phase B we support MARKET orders
// driven by quoteOrderQty (you say "spend $100 USDT" and Binance computes
// the BTC quantity). LIMIT and quantity-driven MARKET are also supported.

import { decrypt } from '../_lib/encryption.js'
import { binanceSigned } from '../_lib/binanceSign.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }

  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const { testnet, symbol, side, type, quoteOrderQty, quantity, price } = req.body || {}
  if (!symbol || !side || !type) {
    return jsonResponse(res, 400, { error: 'missing symbol, side or type' })
  }
  if (!['BUY', 'SELL'].includes(side)) {
    return jsonResponse(res, 400, { error: 'side must be BUY or SELL' })
  }
  if (!['MARKET', 'LIMIT'].includes(type)) {
    return jsonResponse(res, 400, { error: 'only MARKET and LIMIT supported' })
  }
  if (type === 'MARKET' && !quoteOrderQty && !quantity) {
    return jsonResponse(res, 400, { error: 'MARKET needs quoteOrderQty or quantity' })
  }
  if (type === 'LIMIT' && (!quantity || !price)) {
    return jsonResponse(res, 400, { error: 'LIMIT needs quantity and price' })
  }

  const isTestnet = !!testnet
  const admin = getAdminClient()
  const { data: row, error: dbError } = await admin
    .from('user_exchange_keys')
    .select('api_key_encrypted, api_secret_encrypted')
    .eq('user_id', user.user_id)
    .eq('exchange', 'binance')
    .eq('testnet', isTestnet)
    .maybeSingle()

  if (dbError) {
    console.error('binance/order db error:', dbError)
    return jsonResponse(res, 500, { error: 'failed to load key' })
  }
  if (!row) {
    return jsonResponse(res, 404, { error: 'no Binance key configured' })
  }

  let apiKey, apiSecret
  try {
    apiKey = decrypt(row.api_key_encrypted)
    apiSecret = decrypt(row.api_secret_encrypted)
  } catch {
    return jsonResponse(res, 500, { error: 'failed to decrypt key' })
  }

  const params = { symbol: symbol.toUpperCase(), side, type }
  if (type === 'MARKET') {
    if (quoteOrderQty) params.quoteOrderQty = String(quoteOrderQty)
    else params.quantity = String(quantity)
  } else {
    params.quantity = String(quantity)
    params.price = String(price)
    params.timeInForce = 'GTC'
  }
  params.newOrderRespType = 'FULL'

  let order
  try {
    order = await binanceSigned({
      apiKey, apiSecret, testnet: isTestnet,
      method: 'POST',
      path: '/api/v3/order',
      params,
    })
  } catch (e) {
    return jsonResponse(res, 502, { error: e.message })
  }

  admin
    .from('user_exchange_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', user.user_id)
    .eq('exchange', 'binance')
    .eq('testnet', isTestnet)
    .then(() => {}, () => {})

  // Compute the average fill price across fills for clean display.
  let totalQty = 0, totalCost = 0
  for (const f of order.fills || []) {
    const q = +f.qty
    totalQty += q
    totalCost += q * (+f.price)
  }
  const avgPrice = totalQty > 0 ? totalCost / totalQty : null

  return jsonResponse(res, 200, {
    orderId: order.orderId,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    status: order.status,
    executedQty: +order.executedQty,
    cummulativeQuoteQty: +order.cummulativeQuoteQty,
    avgPrice,
    transactTime: order.transactTime,
    fills: order.fills || [],
  })
}

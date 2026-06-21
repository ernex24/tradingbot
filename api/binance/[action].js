// Consolidated authenticated Binance proxy: /api/binance/balance,
// /api/binance/order, /api/binance/orders. One Vercel function.

import { decrypt } from '../_lib/encryption.js'
import { binanceSigned } from '../_lib/binanceSign.js'
import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'
import { prepareSell, prepareBuy } from '../_lib/binanceFilters.js'

async function loadKey(admin, userId, testnet) {
  const { data: row } = await admin
    .from('user_exchange_keys')
    .select('api_key_encrypted, api_secret_encrypted')
    .eq('user_id', userId)
    .eq('exchange', 'binance')
    .eq('testnet', testnet)
    .maybeSingle()
  if (!row) return null
  try {
    return {
      apiKey: decrypt(row.api_key_encrypted),
      apiSecret: decrypt(row.api_secret_encrypted),
    }
  } catch { return null }
}

async function balance(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  const testnet = req.query.testnet === '1' || req.query.testnet === 'true'
  const k = await loadKey(admin, user.user_id, testnet)
  if (!k) return jsonResponse(res, 404, { error: `no Binance ${testnet ? 'Testnet' : 'Mainnet'} key configured` })
  let account
  try {
    account = await binanceSigned({
      apiKey: k.apiKey, apiSecret: k.apiSecret, testnet,
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

async function order(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { testnet, symbol, side, type, quoteOrderQty, quantity, price } = req.body || {}
  if (!symbol || !side || !type) return jsonResponse(res, 400, { error: 'missing symbol, side or type' })
  if (!['BUY', 'SELL'].includes(side)) return jsonResponse(res, 400, { error: 'side must be BUY or SELL' })
  if (!['MARKET', 'LIMIT'].includes(type)) return jsonResponse(res, 400, { error: 'only MARKET and LIMIT supported' })
  if (type === 'MARKET' && !quoteOrderQty && !quantity) {
    return jsonResponse(res, 400, { error: 'MARKET needs quoteOrderQty or quantity' })
  }
  if (type === 'LIMIT' && (!quantity || !price)) {
    return jsonResponse(res, 400, { error: 'LIMIT needs quantity and price' })
  }
  const isTestnet = !!testnet
  const k = await loadKey(admin, user.user_id, isTestnet)
  if (!k) return jsonResponse(res, 404, { error: 'no Binance key configured' })

  const upperSymbol = symbol.toUpperCase()
  const params = { symbol: upperSymbol, side, type }
  if (type === 'MARKET') {
    // Server-side pre-flight: snap to symbol filters + cap at the
    // actual wallet balance so the browser can't ask for a quantity
    // that LOT_SIZE or insufficient-balance would reject. Same gate
    // the cron uses internally.
    try {
      if (side === 'SELL' && quantity != null) {
        params.quantity = await prepareSell({
          creds: { apiKey: k.apiKey, apiSecret: k.apiSecret },
          testnet: isTestnet,
          symbol: upperSymbol,
          wantQty: quantity,
        })
      } else if (side === 'BUY' && quoteOrderQty != null) {
        params.quoteOrderQty = await prepareBuy({
          creds: { apiKey: k.apiKey, apiSecret: k.apiSecret },
          testnet: isTestnet,
          symbol: upperSymbol,
          plannedQuote: quoteOrderQty,
        })
      } else if (quoteOrderQty) {
        params.quoteOrderQty = String(quoteOrderQty)
      } else {
        params.quantity = String(quantity)
      }
    } catch (e) {
      return jsonResponse(res, 400, { error: e.message })
    }
  } else {
    params.quantity = String(quantity)
    params.price = String(price)
    params.timeInForce = 'GTC'
  }
  params.newOrderRespType = 'FULL'

  let result
  try {
    result = await binanceSigned({
      apiKey: k.apiKey, apiSecret: k.apiSecret, testnet: isTestnet,
      method: 'POST', path: '/api/v3/order', params,
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
  let totalQty = 0, totalCost = 0
  for (const f of result.fills || []) {
    const q = +f.qty
    totalQty += q
    totalCost += q * (+f.price)
  }
  const avgPrice = totalQty > 0 ? totalCost / totalQty : null
  return jsonResponse(res, 200, {
    orderId: result.orderId,
    symbol: result.symbol,
    side: result.side,
    type: result.type,
    status: result.status,
    executedQty: +result.executedQty,
    cummulativeQuoteQty: +result.cummulativeQuoteQty,
    avgPrice,
    transactTime: result.transactTime,
    fills: result.fills || [],
  })
}

async function listOrders(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  const testnet = req.query.testnet === '1' || req.query.testnet === 'true'
  const symbol = req.query.symbol ? String(req.query.symbol).toUpperCase() : null
  const k = await loadKey(admin, user.user_id, testnet)
  if (!k) return jsonResponse(res, 404, { error: 'no Binance key configured' })
  try {
    const orders = await binanceSigned({
      apiKey: k.apiKey, apiSecret: k.apiSecret, testnet,
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

export default async function handler(req, res) {
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }
  const admin = getAdminClient()
  const { action } = req.query
  if (action === 'balance') return balance(req, res, user, admin)
  if (action === 'order') return order(req, res, user, admin)
  if (action === 'orders') return listOrders(req, res, user, admin)
  return jsonResponse(res, 404, { error: 'action not found' })
}

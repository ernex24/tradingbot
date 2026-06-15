// Consolidated trades endpoint: /api/trades/list (GET) and
// /api/trades/save (POST). One Vercel function.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

const REQUIRED = [
  'botId', 'botName', 'symbol', 'side', 'entryTime', 'entryPrice',
  'qty', 'invested', 'exitTime', 'exitPrice', 'pnlUSD', 'netPct', 'feeUSD',
]

async function save(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const body = req.body || {}
  for (const k of REQUIRED) {
    if (body[k] == null) return jsonResponse(res, 400, { error: `missing ${k}` })
  }
  const { error } = await admin
    .from('bot_trades')
    .upsert({
      user_id: user.user_id,
      bot_id: String(body.botId),
      bot_name: String(body.botName),
      exchange: 'binance',
      testnet: body.testnet !== false,
      symbol: String(body.symbol),
      side: String(body.side),
      entry_time: new Date(body.entryTime).toISOString(),
      entry_price: Number(body.entryPrice),
      qty: Number(body.qty),
      invested: Number(body.invested),
      exit_time: new Date(body.exitTime).toISOString(),
      exit_price: Number(body.exitPrice),
      pnl_usd: Number(body.pnlUSD),
      net_pct: Number(body.netPct),
      fee_usd: Number(body.feeUSD),
      reason: body.reason ? String(body.reason) : null,
      entry_order_id: body.entryOrderId ? String(body.entryOrderId) : null,
      exit_order_id: body.exitOrderId ? String(body.exitOrderId) : null,
    }, { onConflict: 'user_id,bot_id,entry_time,exit_time' })
  if (error) {
    console.error('trades/save db error:', error)
    return jsonResponse(res, 500, { error: 'failed to save trade' })
  }
  return jsonResponse(res, 200, { saved: true })
}

async function list(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  let q = admin
    .from('bot_trades')
    .select(`
      id, bot_id, bot_name, exchange, testnet, symbol, side,
      entry_time, entry_price, qty, invested,
      exit_time, exit_price, pnl_usd, net_pct, fee_usd,
      reason, entry_order_id, exit_order_id, created_at
    `)
    .eq('user_id', user.user_id)
    .order('exit_time', { ascending: false })
    .limit(500)
  if (req.query.botId) q = q.eq('bot_id', String(req.query.botId))
  const { data, error } = await q
  if (error) {
    console.error('trades/list db error:', error)
    return jsonResponse(res, 500, { error: 'failed to fetch trades' })
  }
  return jsonResponse(res, 200, {
    trades: (data || []).map(t => ({
      id: t.id,
      botId: t.bot_id,
      botName: t.bot_name,
      symbol: t.symbol,
      side: t.side,
      testnet: t.testnet,
      entryTime: new Date(t.entry_time).getTime(),
      entryPrice: +t.entry_price,
      qty: +t.qty,
      invested: +t.invested,
      exitTime: new Date(t.exit_time).getTime(),
      exitPrice: +t.exit_price,
      pnlUSD: +t.pnl_usd,
      netPct: +t.net_pct,
      feeUSD: +t.fee_usd,
      reason: t.reason,
      entryOrderId: t.entry_order_id,
      exitOrderId: t.exit_order_id,
    })),
  })
}

export default async function handler(req, res) {
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }
  const admin = getAdminClient()
  const { action } = req.query
  if (action === 'list') return list(req, res, user, admin)
  if (action === 'save') return save(req, res, user, admin)
  return jsonResponse(res, 404, { error: 'action not found' })
}

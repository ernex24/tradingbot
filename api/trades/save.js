// POST /api/trades/save
// Body: { botId, botName, symbol, side, entryTime, entryPrice, qty,
//         invested, exitTime, exitPrice, pnlUSD, netPct, feeUSD,
//         reason, entryOrderId, exitOrderId, testnet }
// Requires Authorization: Bearer <Supabase JWT>.
// Persists a closed trade. Uses unique (user_id, bot_id, entry_time,
// exit_time) so duplicate saves are idempotent.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

const REQUIRED = [
  'botId', 'botName', 'symbol', 'side', 'entryTime', 'entryPrice',
  'qty', 'invested', 'exitTime', 'exitPrice', 'pnlUSD', 'netPct', 'feeUSD',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const body = req.body || {}
  for (const k of REQUIRED) {
    if (body[k] == null) return jsonResponse(res, 400, { error: `missing ${k}` })
  }

  const admin = getAdminClient()
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

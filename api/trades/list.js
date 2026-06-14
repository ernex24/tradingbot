// GET /api/trades/list[?botId=xxx]
// Requires Authorization: Bearer <Supabase JWT>.
// Returns up to 500 most recent closed trades for the user, optionally
// filtered by botId.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const admin = getAdminClient()
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

  if (req.query.botId) {
    q = q.eq('bot_id', String(req.query.botId))
  }

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

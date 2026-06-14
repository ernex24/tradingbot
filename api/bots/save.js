// POST /api/bots/save
// Body: { id, name, config, state, running }
// Upserts the bot keyed by (user_id, client_id). Strips candles and
// closedTrades from state (those live in memory / bot_trades).

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const { id, name, config, state, running } = req.body || {}
  if (!id || !name || !config || !state) {
    return jsonResponse(res, 400, { error: 'missing id, name, config or state' })
  }

  const cleanState = { ...state }
  delete cleanState.candles
  delete cleanState.closedTrades

  const admin = getAdminClient()
  const { error } = await admin
    .from('user_bots')
    .upsert({
      user_id: user.user_id,
      client_id: String(id),
      name: String(name),
      config: config,
      state: cleanState,
      running: running !== false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,client_id' })

  if (error) {
    console.error('bots/save db error:', error)
    return jsonResponse(res, 500, { error: 'failed to save bot' })
  }

  return jsonResponse(res, 200, { saved: true })
}

// POST /api/bots/delete
// Body: { id }
// Removes the bot AND its bot_trades rows.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const { id } = req.body || {}
  if (!id) return jsonResponse(res, 400, { error: 'missing id' })

  const admin = getAdminClient()
  const { error: botErr } = await admin
    .from('user_bots')
    .delete()
    .eq('user_id', user.user_id)
    .eq('client_id', String(id))

  const { error: tradeErr } = await admin
    .from('bot_trades')
    .delete()
    .eq('user_id', user.user_id)
    .eq('bot_id', String(id))

  if (botErr || tradeErr) {
    console.error('bots/delete db error:', botErr || tradeErr)
    return jsonResponse(res, 500, { error: 'failed to delete' })
  }

  return jsonResponse(res, 200, { deleted: true })
}

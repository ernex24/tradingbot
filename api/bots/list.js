// GET /api/bots/list
// Requires Authorization: Bearer <Supabase JWT>.
// Returns the user's bots — config, state (without candles or
// closedTrades), and running flag.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('user_bots')
    .select('client_id, name, config, state, running, created_at, updated_at')
    .eq('user_id', user.user_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('bots/list db error:', error)
    return jsonResponse(res, 500, { error: 'failed to fetch bots' })
  }

  return jsonResponse(res, 200, {
    bots: (data || []).map(row => ({
      id: row.client_id,
      name: row.name,
      config: row.config,
      state: row.state,
      running: row.running,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    })),
  })
}

// POST /api/keys/delete
// Body: { exchange, testnet }
// Requires Authorization: Bearer <Supabase JWT>.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'method not allowed' })
  }

  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }

  const { exchange, testnet } = req.body || {}
  if (!exchange) {
    return jsonResponse(res, 400, { error: 'missing exchange' })
  }

  const admin = getAdminClient()
  const { error } = await admin
    .from('user_exchange_keys')
    .delete()
    .eq('user_id', user.user_id)
    .eq('exchange', exchange)
    .eq('testnet', !!testnet)

  if (error) {
    console.error('keys/delete db error:', error)
    return jsonResponse(res, 500, { error: 'failed to delete' })
  }

  return jsonResponse(res, 200, { deleted: true, exchange, testnet: !!testnet })
}

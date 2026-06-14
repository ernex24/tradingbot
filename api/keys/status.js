// GET /api/keys/status
// Requires Authorization: Bearer <Supabase JWT>.
// Returns { keys: [{ exchange, testnet, keyHint, permissions, createdAt, lastUsedAt }] }.
// Never returns the actual key or secret — only metadata.

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
    .from('user_exchange_keys')
    .select('exchange, testnet, key_hint, permissions, created_at, last_used_at')
    .eq('user_id', user.user_id)

  if (error) {
    console.error('keys/status db error:', error)
    return jsonResponse(res, 500, { error: 'failed to fetch status' })
  }

  return jsonResponse(res, 200, {
    keys: (data || []).map(row => ({
      exchange: row.exchange,
      testnet: !!row.testnet,
      keyHint: row.key_hint,
      permissions: row.permissions || [],
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    })),
  })
}

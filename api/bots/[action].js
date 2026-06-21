// Consolidated bots endpoint: /api/bots/list (GET), /api/bots/save
// (POST), /api/bots/delete (POST). Single Vercel function file.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

async function list(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { data, error } = await admin
    .from('user_bots')
    .select('client_id, name, config, state, running, server_managed, created_at, updated_at')
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
      serverManaged: row.server_managed !== false,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    })),
  })
}

async function save(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { id, name, config, state, running, serverManaged } = req.body || {}
  if (!id || !name || !config || !state) {
    return jsonResponse(res, 400, { error: 'missing id, name, config or state' })
  }
  const cleanState = { ...state }
  delete cleanState.candles
  delete cleanState.closedTrades
  const row = {
    user_id: user.user_id,
    client_id: String(id),
    name: String(name),
    config,
    state: cleanState,
    running: running !== false,
    updated_at: new Date().toISOString(),
  }
  if (typeof serverManaged === 'boolean') row.server_managed = serverManaged
  const { error } = await admin
    .from('user_bots')
    .upsert(row, { onConflict: 'user_id,client_id' })
  if (error) {
    console.error('bots/save db error:', error)
    return jsonResponse(res, 500, { error: 'failed to save bot' })
  }
  return jsonResponse(res, 200, { saved: true })
}

async function remove(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { id } = req.body || {}
  if (!id) return jsonResponse(res, 400, { error: 'missing id' })
  // Delete the bot row but PRESERVE its trades in bot_trades so the
  // network's lifetime KPIs (realized P&L, total invested, fees, W/L)
  // survive deletion. Each trade row already carries bot_name +
  // symbol + testnet, so it's self-contained.
  const { error: botErr } = await admin
    .from('user_bots')
    .delete()
    .eq('user_id', user.user_id)
    .eq('client_id', String(id))
  if (botErr) {
    console.error('bots/delete db error:', botErr)
    return jsonResponse(res, 500, { error: 'failed to delete' })
  }
  return jsonResponse(res, 200, { deleted: true })
}

export default async function handler(req, res) {
  let user
  try { user = await requireUser(req) }
  catch { return jsonResponse(res, 401, { error: 'unauthorized' }) }
  const admin = getAdminClient()
  const { action } = req.query
  if (action === 'list') return list(req, res, user, admin)
  if (action === 'save') return save(req, res, user, admin)
  if (action === 'delete') return remove(req, res, user, admin)
  return jsonResponse(res, 404, { error: 'action not found' })
}

// Consolidated bots endpoint: /api/bots/list (GET), /api/bots/save
// (POST), /api/bots/delete (POST). Single Vercel function file.

import { getAdminClient, requireUser, jsonResponse } from '../_lib/supabaseServer.js'

async function list(req, res, user, admin) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
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

async function save(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { id, name, config, state, running } = req.body || {}
  if (!id || !name || !config || !state) {
    return jsonResponse(res, 400, { error: 'missing id, name, config or state' })
  }
  const cleanState = { ...state }
  delete cleanState.candles
  delete cleanState.closedTrades
  const { error } = await admin
    .from('user_bots')
    .upsert({
      user_id: user.user_id,
      client_id: String(id),
      name: String(name),
      config,
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

async function remove(req, res, user, admin) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'method not allowed' })
  const { id } = req.body || {}
  if (!id) return jsonResponse(res, 400, { error: 'missing id' })
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

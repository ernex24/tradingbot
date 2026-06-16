// Server-side bot tick — replaces the browser useEffect loop.
//
// Triggered every minute by an external cron service (cron-job.org or
// similar) POSTing with:
//   Authorization: Bearer ${CRON_SECRET}
//
// For each user_bots row where running=true AND server_managed=true:
//   1. Fetch fresh candles from Binance public REST.
//   2. Run the strategy → signal.
//   3. SL/TP intrabar check (long-only on Spot).
//   4. Signal-change → MARKET BUY or MARKET SELL.
//   5. Persist new state + new closed trade rows + Telegram notify.

import { getAdminClient } from '../_lib/supabaseServer.js'
import { decrypt } from '../_lib/encryption.js'
import { binanceSigned } from '../_lib/binanceSign.js'
import { STRATS } from '../../src/lib/strategies.js'

const COIN_TO_SYMBOL = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT',
  SOL: 'SOLUSDT', DOGE: 'DOGEUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT',
  TRX: 'TRXUSDT', LINK: 'LINKUSDT', DOT: 'DOTUSDT', LTC: 'LTCUSDT',
  POL: 'POLUSDT', SHIB: 'SHIBUSDT', UNI: 'UNIUSDT', ATOM: 'ATOMUSDT',
  NEAR: 'NEARUSDT', APT: 'APTUSDT', SUI: 'SUIUSDT', PEPE: 'PEPEUSDT',
}

const MAINNET = 'https://api.binance.com'
const TESTNET = 'https://testnet.binance.vision'

async function fetchCandles(symbol, interval, limit, testnet) {
  const base = testnet ? TESTNET : MAINNET
  const url = `${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`klines HTTP ${r.status}`)
  const rows = await r.json()
  return rows.map(k => ({
    t: k[0],
    o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
  }))
}

async function loadKey(admin, userId, testnet) {
  const { data: row } = await admin
    .from('user_exchange_keys')
    .select('api_key_encrypted, api_secret_encrypted')
    .eq('user_id', userId)
    .eq('exchange', 'binance')
    .eq('testnet', testnet)
    .maybeSingle()
  if (!row) return null
  try {
    return {
      apiKey: decrypt(row.api_key_encrypted),
      apiSecret: decrypt(row.api_secret_encrypted),
    }
  } catch { return null }
}

function describeOrder(side, symbol, args) {
  if (args.quoteOrderQty) {
    return `${side} ${(+args.quoteOrderQty).toFixed(2)} USDT of ${symbol}`
  }
  if (args.quantity) {
    return `${side} ${args.quantity} ${symbol}`
  }
  return `${side} ${symbol}`
}

async function placeMarket(creds, testnet, symbol, side, args) {
  const params = {
    symbol, side, type: 'MARKET',
    newOrderRespType: 'FULL',
    ...args,
  }
  const intent = describeOrder(side, symbol, args)
  let result
  try {
    result = await binanceSigned({
      apiKey: creds.apiKey, apiSecret: creds.apiSecret, testnet,
      method: 'POST', path: '/api/v3/order', params,
    })
  } catch (e) {
    const inner = e?.message || String(e)
    const err = new Error(`Tried to ${intent} — ${inner}`)
    err.orderIntent = intent
    err.cause = e
    throw err
  }
  let totalQty = 0, totalCost = 0
  for (const f of result.fills || []) {
    const q = +f.qty
    totalQty += q
    totalCost += q * (+f.price)
  }
  const avgPrice = totalQty > 0 ? totalCost / totalQty : null
  return {
    orderId: result.orderId,
    executedQty: +result.executedQty,
    cummulativeQuoteQty: +result.cummulativeQuoteQty,
    avgPrice,
  }
}

function applyEntry(state, side, order, currentTime, stopPct, takePct) {
  const qty = order.executedQty
  const invested = order.cummulativeQuoteQty
  const entryPrice = order.avgPrice ?? (invested / qty)
  const slPrice = stopPct > 0 ? entryPrice * (1 - side * stopPct / 100) : null
  const tpPrice = takePct > 0 ? entryPrice * (1 + side * takePct / 100) : null
  return {
    ...state,
    cash: state.cash - invested,
    openPosition: {
      side, invested, qty, entryPrice,
      entryTime: currentTime,
      slPrice, tpPrice,
      entryOrderId: order.orderId,
    },
  }
}

function applyExit(state, exitPriceFallback, currentTime, reason, order) {
  const op = state.openPosition
  if (!op) return { state, trade: null }
  const proceeds = order.cummulativeQuoteQty
  const exitPrice = order.avgPrice ?? (proceeds / order.executedQty) ?? exitPriceFallback
  const grossPnL = op.invested * op.side * (exitPrice - op.entryPrice) / op.entryPrice
  const pnlUSD = proceeds - op.invested
  const feeUSD = Math.max(0, grossPnL - pnlUSD)
  const grossPct = op.side * (exitPrice - op.entryPrice) / op.entryPrice * 100
  const netPct = (pnlUSD / op.invested) * 100
  const trade = {
    side: op.side === 1 ? 'long' : 'short',
    entryPrice: op.entryPrice,
    entryTime: op.entryTime,
    exitPrice,
    exitTime: currentTime,
    invested: op.invested,
    qty: op.qty,
    grossPct, netPct, pnlUSD, feeUSD,
    reason,
    entryOrderId: op.entryOrderId,
    exitOrderId: order.orderId,
  }
  return {
    state: {
      ...state,
      cash: state.cash + proceeds,
      openPosition: null,
    },
    trade,
  }
}

async function persistClosedTrade(admin, userId, botId, botName, symbol, testnet, trade) {
  const { error } = await admin
    .from('bot_trades')
    .upsert({
      user_id: userId,
      bot_id: String(botId),
      bot_name: String(botName),
      exchange: 'binance',
      testnet,
      symbol,
      side: trade.side,
      entry_time: new Date(trade.entryTime).toISOString(),
      entry_price: Number(trade.entryPrice),
      qty: Number(trade.qty),
      invested: Number(trade.invested),
      exit_time: new Date(trade.exitTime).toISOString(),
      exit_price: Number(trade.exitPrice),
      pnl_usd: Number(trade.pnlUSD),
      net_pct: Number(trade.netPct),
      fee_usd: Number(trade.feeUSD),
      reason: trade.reason || null,
      entry_order_id: trade.entryOrderId ? String(trade.entryOrderId) : null,
      exit_order_id: trade.exitOrderId ? String(trade.exitOrderId) : null,
    }, { onConflict: 'user_id,bot_id,entry_time,exit_time' })
  if (error) console.error('persistClosedTrade error:', error)
}

async function sendTelegram(admin, userId, message) {
  const { data: row } = await admin
    .from('user_notifications')
    .select('telegram_bot_token_encrypted, telegram_chat_id, enabled')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row?.enabled || !row?.telegram_bot_token_encrypted || !row?.telegram_chat_id) return
  let token
  try { token = decrypt(row.telegram_bot_token_encrypted) } catch { return }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: row.telegram_chat_id,
        text: message,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {}
}

function entryMsg(botName, openPos, pair, testnet) {
  const net = testnet ? 'TESTNET' : '<b>MAINNET</b>'
  return `🟢 <b>Entry</b> · ${botName}\n${net}\nBought ${openPos.qty.toFixed(6)} ${pair} at ${openPos.entryPrice.toFixed(2)} USDT`
}
function exitMsg(botName, trade, testnet) {
  const net = testnet ? 'TESTNET' : '<b>MAINNET</b>'
  const sign = trade.pnlUSD >= 0 ? '+' : ''
  return `🔴 <b>Exit</b> · ${botName}\n${net}\nSold at ${trade.exitPrice.toFixed(2)} USDT (${trade.reason})\nP&amp;L: ${sign}${trade.pnlUSD.toFixed(2)} USDT (${sign}${trade.netPct.toFixed(2)}%)`
}

async function tickBot(admin, row) {
  const userId = row.user_id
  const botId = row.client_id
  const botName = row.name
  const cfg = row.config || {}
  const symbol = COIN_TO_SYMBOL[cfg.pair]
  if (!symbol) return { skipped: 'unsupported coin' }
  if (!STRATS[cfg.stratKey]) return { skipped: 'unknown strategy' }

  const isTestnet = cfg.testnet !== false
  const candles = await fetchCandles(symbol, cfg.interval, 200, isTestnet)
  if (candles.length < 2) return { skipped: 'no candles' }

  const S = STRATS[cfg.stratKey]
  const dir = S.supportsDirection ? (cfg.effectiveDirection || cfg.direction || 'long') : 'long'
  const { pos } = S.run(candles, cfg.params, dir)
  const last = candles[candles.length - 1]
  // Same convention as the browser executor: the position computed on the
  // just-closed candle is the desired side going forward. Spot can't short
  // so anything not +1 is treated as flat.
  const signal = pos[pos.length - 1] === 1 ? 1 : 0

  const creds = await loadKey(admin, userId, isTestnet)
  if (!creds) return { skipped: 'no api key', error: `no Binance ${isTestnet ? 'testnet' : 'mainnet'} key configured` }

  // Hydrate state with defaults — the persisted row never carries
  // closedTrades (those live in bot_trades).
  let state = row.state && typeof row.state === 'object' ? { ...row.state } : {}
  if (state.cash == null) state.cash = cfg.stake || 1000
  if (state.startBalance == null) state.startBalance = cfg.stake || 1000
  if (state.openPosition === undefined) state.openPosition = null

  const stopPct = +cfg.stopPct || 0
  const takePct = +cfg.takePct || 0
  const compound = cfg.compound !== false
  const fixedStake = +cfg.stake || state.startBalance
  const currentPrice = last.c
  const currentTime = last.t

  const events = []

  // SL/TP intrabar (long-only on Spot)
  if (state.openPosition && state.openPosition.side === 1) {
    const op = state.openPosition
    let trigger = null
    if (op.slPrice != null && last.l <= op.slPrice) trigger = { px: op.slPrice, reason: 'SL' }
    else if (op.tpPrice != null && last.h >= op.tpPrice) trigger = { px: op.tpPrice, reason: 'TP' }
    if (trigger) {
      const order = await placeMarket(creds, isTestnet, symbol, 'SELL', { quantity: op.qty.toFixed(8) })
      const { state: nextState, trade } = applyExit(state, trigger.px, currentTime, trigger.reason, order)
      state = nextState
      if (trade) {
        await persistClosedTrade(admin, userId, botId, botName, symbol, isTestnet, trade)
        events.push({ kind: 'exit', trade })
      }
    }
  }

  // Signal change
  const desired = signal === 1 ? 1 : 0
  const currentSide = state.openPosition?.side ?? 0
  if (desired !== currentSide) {
    if (state.openPosition) {
      const order = await placeMarket(creds, isTestnet, symbol, 'SELL', {
        quantity: state.openPosition.qty.toFixed(8),
      })
      const { state: nextState, trade } = applyExit(state, currentPrice, currentTime, 'signal', order)
      state = nextState
      if (trade) {
        await persistClosedTrade(admin, userId, botId, botName, symbol, isTestnet, trade)
        events.push({ kind: 'exit', trade })
      }
    }
    if (desired === 1) {
      const room = state.cash * 0.99
      const quoteAmt = compound ? room : Math.min(fixedStake, room)
      if (quoteAmt > 1) {
        const order = await placeMarket(creds, isTestnet, symbol, 'BUY', { quoteOrderQty: quoteAmt.toFixed(2) })
        state = applyEntry(state, 1, order, currentTime, stopPct, takePct)
        events.push({ kind: 'entry', openPos: state.openPosition })
      }
    }
  }

  // Common state updates
  state = {
    ...state,
    lastTickAt: Date.now(),
    lastPrice: currentPrice,
    lastCandleTime: last.t,
    lastError: null,
  }

  // Fire notifications (best-effort)
  for (const ev of events) {
    if (ev.kind === 'entry') {
      await sendTelegram(admin, userId, entryMsg(botName, ev.openPos, cfg.pair, isTestnet))
    } else if (ev.kind === 'exit') {
      await sendTelegram(admin, userId, exitMsg(botName, ev.trade, isTestnet))
    }
  }

  return { state, events: events.length }
}

export default async function handler(req, res) {
  // GET with no auth → liveness probe. Confirms deploy + env without
  // running anything. Useful for verifying the endpoint exists before
  // wiring the cron service.
  if (req.method === 'GET' && !req.query?.token && !(req.headers?.authorization || req.headers?.Authorization)) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({
      ok: true,
      endpoint: 'cron/tick',
      secretConfigured: !!process.env.CRON_SECRET,
      hint: 'POST with Authorization: Bearer <CRON_SECRET> — or GET with ?token=<CRON_SECRET>',
    }))
  }

  // Auth: shared secret from external cron service.
  // Accept either an Authorization: Bearer header (preferred) OR a
  // ?token= query param (fallback for cron services that strip custom
  // headers). The query-param form is fine here because the URL travels
  // over TLS and the secret is rotated independently of user data.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'CRON_SECRET not configured on the server' }))
  }
  const auth = req.headers?.authorization || req.headers?.Authorization || ''
  const headerMatch = auth === `Bearer ${secret}`
  const queryMatch = req.query?.token && String(req.query.token) === secret
  if (!headerMatch && !queryMatch) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({
      error: 'unauthorized',
      hint: auth
        ? 'Authorization header was received but did not match CRON_SECRET. Check for extra whitespace and exact secret value.'
        : 'No Authorization header detected. Either send "Authorization: Bearer <CRON_SECRET>" or call with "?token=<CRON_SECRET>".',
    }))
  }

  const admin = getAdminClient()
  const { data: bots, error } = await admin
    .from('user_bots')
    .select('user_id, client_id, name, config, state, running, server_managed')
    .eq('running', true)
    .eq('server_managed', true)

  if (error) {
    console.error('cron tick load error:', error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: error.message }))
  }

  const results = []
  for (const row of (bots || [])) {
    const id = row.client_id
    try {
      const { state, skipped, error: tickErr, events } = await tickBot(admin, row)
      if (state) {
        const prevError = row.state?.lastError || null
        await admin
          .from('user_bots')
          .update({ state, updated_at: new Date().toISOString() })
          .eq('user_id', row.user_id)
          .eq('client_id', id)
        if (prevError && !state.lastError) {
          const networkTag = row.config?.testnet === false ? '<b>MAINNET</b>' : 'TESTNET'
          await sendTelegram(
            admin,
            row.user_id,
            `✅ <b>Bot recovered</b> · ${row.name}\n${networkTag}\nLast error cleared — bot is ticking normally again.`,
          )
        }
        results.push({ id, ok: true, events })
      } else if (tickErr) {
        const prevError = row.state?.lastError || null
        const errorChanged = prevError !== tickErr
        await admin
          .from('user_bots')
          .update({
            state: { ...(row.state || {}), lastError: tickErr, lastTickAt: Date.now() },
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', row.user_id)
          .eq('client_id', id)
        if (errorChanged) {
          const networkTag = row.config?.testnet === false ? '<b>MAINNET</b>' : 'TESTNET'
          await sendTelegram(
            admin,
            row.user_id,
            `⚠ <b>Bot can't tick</b> · ${row.name}\n${networkTag}\n${tickErr}`,
          )
        }
        results.push({ id, skipped, error: tickErr })
      } else {
        results.push({ id, skipped: skipped || 'noop' })
      }
    } catch (e) {
      const msg = String(e?.message || e)
      console.error(`bot ${id} tick error:`, msg)
      // Keep the bot RUNNING on error — pausing would also stop SL/TP
      // monitoring on any open position, which is the riskier outcome.
      // Surface the error in state.lastError and Telegram only on
      // *transitions* (new error or message changed) so a stuck bot
      // doesn't notify every minute.
      const prevError = row.state?.lastError || null
      const errorChanged = prevError !== msg
      await admin
        .from('user_bots')
        .update({
          state: { ...(row.state || {}), lastError: msg, lastTickAt: Date.now() },
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', row.user_id)
        .eq('client_id', id)
      if (errorChanged) {
        const networkTag = row.config?.testnet === false ? '<b>MAINNET</b>' : 'TESTNET'
        await sendTelegram(
          admin,
          row.user_id,
          `⚠ <b>Bot tick failed</b> · ${row.name}\n${networkTag}\n${msg}\n\nThe bot keeps running — open positions are still monitored for SL/TP. Fix the underlying issue (top up wallet, adjust config) and the next tick will retry.`,
        )
      }
      results.push({ id, error: msg })
    }
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  return res.end(JSON.stringify({ ticked: results.length, results }))
}

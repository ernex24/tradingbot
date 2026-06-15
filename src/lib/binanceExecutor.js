// Real-execution counterpart of paperTrader.tick().
// Same state shape and semantics, but instead of mutating an internal
// virtual balance it places real MARKET orders on Binance Testnet via
// /api/binance/order and seeds the state with the actual fills.
//
// Binance Spot is long-only — we never send SHORT orders.
// Coins not on Binance Spot (HYPE) are unsupported and the call throws.

import { authFetch } from './supabase.js'

// All coins shown in the UI are live on Binance Spot Testnet — every
// one can be wired to an actual order. Verified against
// testnet.binance.vision /api/v3/exchangeInfo.
const COIN_TO_SYMBOL = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT',
  SOL: 'SOLUSDT', DOGE: 'DOGEUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT',
  TRX: 'TRXUSDT', LINK: 'LINKUSDT', DOT: 'DOTUSDT', LTC: 'LTCUSDT',
  POL: 'POLUSDT', SHIB: 'SHIBUSDT', UNI: 'UNIUSDT', ATOM: 'ATOMUSDT',
  NEAR: 'NEARUSDT', APT: 'APTUSDT', SUI: 'SUIUSDT', PEPE: 'PEPEUSDT',
}

export function symbolFor(coin) {
  return COIN_TO_SYMBOL[coin]
}

export function executorSupportsCoin(coin) {
  return !!COIN_TO_SYMBOL[coin]
}

async function placeMarket(testnet, symbol, side, args) {
  const r = await authFetch('/api/binance/order', {
    method: 'POST',
    body: JSON.stringify({ testnet, symbol, side, type: 'MARKET', ...args }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || `order ${side} failed`)
  return data
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
      side, invested, qty,
      entryPrice,
      entryTime: currentTime,
      slPrice, tpPrice,
      entryOrderId: order.orderId,
    },
  }
}

function applyExit(state, exitPriceFallback, currentTime, reason, order) {
  const op = state.openPosition
  if (!op) return state
  const proceeds = order.cummulativeQuoteQty
  const exitPrice = order.avgPrice ?? (proceeds / order.executedQty) ?? exitPriceFallback
  // Gross PnL = what the price move alone would have produced.
  // Real proceeds are already net of Binance fees, so:
  //   feeUSD = gross_pnl - net_pnl
  const grossPnL = op.invested * op.side * (exitPrice - op.entryPrice) / op.entryPrice
  const pnlUSD = proceeds - op.invested
  const feeUSD = Math.max(0, grossPnL - pnlUSD)
  const grossPct = op.side * (exitPrice - op.entryPrice) / op.entryPrice * 100
  const netPct = (pnlUSD / op.invested) * 100
  return {
    ...state,
    cash: state.cash + proceeds,
    openPosition: null,
    closedTrades: [...state.closedTrades, {
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
    }],
  }
}

// Sells the bot's current open position at market and returns the
// new state with the trade moved to closedTrades. Used by the
// "Close now" button and the "Close & delete" path.
export async function closeOpenPosition(state, coin, testnet, reason = 'manual') {
  const op = state.openPosition
  if (!op) return state
  if (op.side !== 1) throw new Error('Only long positions can be closed via spot SELL')
  const symbol = symbolFor(coin)
  if (!symbol) throw new Error(`${coin} not available on Binance Spot`)
  const order = await placeMarket(testnet, symbol, 'SELL', {
    quantity: op.qty.toFixed(8),
  })
  const next = applyExit(state, op.entryPrice, Date.now(), reason, order)
  return {
    ...next,
    lastTickAt: Date.now(),
    lastPrice: order.avgPrice ?? state.lastPrice,
  }
}

// async drop-in replacement for paperTrader.tick when bot.config.executor
// is 'binance-testnet'.
export async function executeTick(state, signal, currentPrice, currentCandle, currentTime, opts) {
  const {
    stopPct = 0, takePct = 0, compound = true,
    fixedStake = state.startBalance, coin,
    // SAFETY: testnet defaults to true. Mainnet bots MUST explicitly
    // pass testnet:false. A missing flag never costs real money.
    testnet = true,
  } = opts

  const symbol = symbolFor(coin)
  if (!symbol) throw new Error(`${coin} not available on Binance Spot`)

  let next = state

  // 1. SL/TP intrabar check (long only on Spot)
  if (next.openPosition && next.openPosition.side === 1) {
    const op = next.openPosition
    const hi = currentCandle?.h ?? currentPrice
    const lo = currentCandle?.l ?? currentPrice
    let trigger = null
    if (op.slPrice != null && lo <= op.slPrice) trigger = { px: op.slPrice, reason: 'SL' }
    else if (op.tpPrice != null && hi >= op.tpPrice) trigger = { px: op.tpPrice, reason: 'TP' }
    if (trigger) {
      const order = await placeMarket(testnet, symbol, 'SELL', { quantity: op.qty.toFixed(8) })
      next = applyExit(next, trigger.px, currentTime, trigger.reason, order)
    }
  }

  // 2. Strategy signal change
  // We treat any non-+1 signal as "be flat" because spot can't short.
  const desired = signal === 1 ? 1 : 0
  const currentSide = next.openPosition?.side ?? 0
  if (desired !== currentSide) {
    if (next.openPosition) {
      const order = await placeMarket(testnet, symbol, 'SELL', { quantity: next.openPosition.qty.toFixed(8) })
      next = applyExit(next, currentPrice, currentTime, 'signal', order)
    }
    if (desired === 1) {
      const room = next.cash * 0.99 // leave a sliver for fees / rounding
      const quoteAmt = compound ? room : Math.min(fixedStake, room)
      if (quoteAmt > 1) {
        const order = await placeMarket(testnet, symbol, 'BUY', { quoteOrderQty: quoteAmt.toFixed(2) })
        next = applyEntry(next, 1, order, currentTime, stopPct, takePct)
      }
    }
  }

  return {
    ...next,
    lastTickAt: currentTime,
    lastPrice: currentPrice,
    lastCandleTime: currentCandle?.t ?? currentTime,
  }
}

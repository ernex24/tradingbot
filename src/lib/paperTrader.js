// Live paper trading state machine. Runs forward in time against polled
// live prices instead of historical backtest data. State persists to
// localStorage so it survives page reloads.

import { COM } from './backtest.js'

export function createInitialState(startBalance) {
  return {
    startBalance,
    cash: startBalance,
    openPosition: null,
    closedTrades: [],
    startedAt: Date.now(),
    lastTickAt: null,
    lastPrice: null,
    lastCandleTime: null,
    runId: Math.random().toString(36).slice(2, 10),
  }
}

// Mark-to-market value of equity at currentPrice (ignores exit fee).
export function equity(state, currentPrice) {
  if (!state.openPosition || currentPrice == null) return state.cash
  const op = state.openPosition
  const positionValue = op.invested * (1 + op.side * (currentPrice - op.entryPrice) / op.entryPrice)
  return state.cash + positionValue
}

export function floatingPnL(op, currentPrice) {
  if (!op || currentPrice == null) return 0
  return op.invested * op.side * (currentPrice - op.entryPrice) / op.entryPrice
}

export function openPosition(state, side, currentPrice, currentTime, opts) {
  const { stopPct = 0, takePct = 0, compound = true, fixedStake = state.startBalance } = opts
  // Reserve a slice of cash for fees so we don't overdraw on the entry commission.
  const room = state.cash / (1 + COM)
  const target = compound ? room : Math.min(fixedStake, room)
  if (target <= 0) return state
  const invested = target
  const qty = invested / currentPrice
  const entryFee = invested * COM
  const slPrice = stopPct > 0 ? currentPrice * (1 - side * stopPct / 100) : null
  const tpPrice = takePct > 0 ? currentPrice * (1 + side * takePct / 100) : null
  return {
    ...state,
    cash: state.cash - invested - entryFee,
    openPosition: {
      side, invested, qty,
      entryPrice: currentPrice,
      entryTime: currentTime,
      slPrice, tpPrice,
    },
  }
}

export function closePosition(state, exitPrice, currentTime, reason) {
  const op = state.openPosition
  if (!op) return state
  const positionValue = op.invested * (1 + op.side * (exitPrice - op.entryPrice) / op.entryPrice)
  const exitFee = op.invested * COM
  const proceeds = positionValue - exitFee
  const grossPct = op.side * (exitPrice - op.entryPrice) / op.entryPrice * 100
  const netPct = grossPct - 2 * COM * 100
  const pnlUSD = op.invested * (op.side * (exitPrice - op.entryPrice) / op.entryPrice - 2 * COM)
  const feeUSD = op.invested * COM * 2
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
    }],
  }
}

// One forward step. Checks intrabar SL/TP first (using candle high/low),
// then applies strategy signal at the current close.
export function tick(state, signal, currentPrice, currentCandle, currentTime, opts) {
  let next = state

  if (next.openPosition) {
    const op = next.openPosition
    const hi = currentCandle?.h ?? currentPrice
    const lo = currentCandle?.l ?? currentPrice
    let exitPx = null, reason = null
    if (op.side === 1) {
      if (op.slPrice != null && lo <= op.slPrice) { exitPx = op.slPrice; reason = 'SL' }
      else if (op.tpPrice != null && hi >= op.tpPrice) { exitPx = op.tpPrice; reason = 'TP' }
    } else {
      if (op.slPrice != null && hi >= op.slPrice) { exitPx = op.slPrice; reason = 'SL' }
      else if (op.tpPrice != null && lo <= op.tpPrice) { exitPx = op.tpPrice; reason = 'TP' }
    }
    if (exitPx != null) {
      next = closePosition(next, exitPx, currentTime, reason)
    }
  }

  const currentSide = next.openPosition?.side ?? 0
  if (signal !== currentSide) {
    if (next.openPosition) {
      next = closePosition(next, currentPrice, currentTime, 'signal')
    }
    if (signal !== 0) {
      next = openPosition(next, signal, currentPrice, currentTime, opts)
    }
  }

  return {
    ...next,
    lastTickAt: currentTime,
    lastPrice: currentPrice,
    lastCandleTime: currentCandle?.t ?? currentTime,
  }
}

// State shape helpers for live bots (executed via Binance Testnet).
// Naming stayed "paperTrader" for module/import compat — the concept of
// a virtual paper bot was removed; all bots now place real Testnet orders.

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

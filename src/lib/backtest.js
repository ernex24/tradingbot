export const STAKE = 1000
export const COM = 0.0016 // 0.16% per side (Kraken/Binance taker approx.)

// posRaw[i] ∈ {-1, 0, +1} = signal computed from data through bar i.
// Executed position during bar i = posRaw[i-1] (no look-ahead).
//
// For shorts: bar return for short side = -(price change). SL fires when
// price RISES above entry by stopPct; TP fires when price FALLS below.
//
// opts:
//   stopPct, takePct: % from entry, 0 = off
//   stake: starting capital in $ (default 1000)
//   compound: true = reinvest profits (default); false = fixed stake per trade
export function backtest(c, posRaw, opts = {}) {
  const stopPct = Number(opts.stopPct) || 0
  const takePct = Number(opts.takePct) || 0
  const stake = Number(opts.stake) || STAKE
  const compound = opts.compound !== false
  const n = c.length

  const want = i => (i > 0 ? (posRaw[i - 1] | 0) : 0)

  let bh = 1
  const eqArr = [1], bhArr = [1]
  const trades = []
  let eq = 1, entryEq = 1
  let realizedEq = 1
  let side = 0
  let entryIdx = -1, entryPrice = 0
  let barsInPos = 0

  const closeTrade = (kind, i, exitPx, reason) => {
    const gross = side * (exitPx - entryPrice) / entryPrice
    const investedUSD = compound ? entryEq * stake : stake
    const qty = investedUSD / entryPrice
    const sides = kind === 'open' ? 1 : 2
    const feeUSD = investedUSD * COM * sides
    const pnlUSD = investedUSD * (gross - sides * COM)
    trades.push({
      ci: entryIdx, cf: c[entryIdx].f, cp: entryPrice,
      vi: kind === 'open' ? null : i,
      vf: kind === 'open' ? null : c[i].f,
      vp: exitPx,
      side: side === 1 ? 'long' : 'short',
      ret: gross * 100,
      retNet: (gross - sides * COM) * 100,
      reason,
      qty, investedUSD, pnlUSD, feeUSD, sides,
    })
  }

  const openPosition = (i, newSide, includeBarReturn) => {
    if (includeBarReturn) {
      const r = newSide * (c[i].c / c[i - 1].c - 1)
      if (compound) {
        eq *= 1 + r - COM
        entryEq = eq
      } else {
        realizedEq -= COM
      }
    } else {
      if (compound) {
        eq *= 1 - COM
        entryEq = eq
      } else {
        realizedEq -= COM
      }
    }
    side = newSide
    entryIdx = i
    entryPrice = c[i].c
    barsInPos++
  }

  for (let i = 1; i < n; i++) {
    bh *= c[i].c / c[i - 1].c

    const desired = want(i)

    // 1. SL/TP intrabar check (only if currently in position)
    let slTpExitPx = null, slTpReason = null
    if (side !== 0) {
      if (side === 1) {
        const slLvl = stopPct > 0 ? entryPrice * (1 - stopPct / 100) : null
        const tpLvl = takePct > 0 ? entryPrice * (1 + takePct / 100) : null
        if (slLvl != null && c[i].l <= slLvl) { slTpExitPx = slLvl; slTpReason = 'SL' }
        else if (tpLvl != null && c[i].h >= tpLvl) { slTpExitPx = tpLvl; slTpReason = 'TP' }
      } else {
        const slLvl = stopPct > 0 ? entryPrice * (1 + stopPct / 100) : null
        const tpLvl = takePct > 0 ? entryPrice * (1 - takePct / 100) : null
        if (slLvl != null && c[i].h >= slLvl) { slTpExitPx = slLvl; slTpReason = 'SL' }
        else if (tpLvl != null && c[i].l <= tpLvl) { slTpExitPx = tpLvl; slTpReason = 'TP' }
      }
    }

    if (slTpExitPx != null) {
      // Forced exit intrabar — bar return computed to the SL/TP price
      const r = side * (slTpExitPx / c[i - 1].c - 1)
      if (compound) {
        eq *= 1 + r - COM
      } else {
        const gross = side * (slTpExitPx - entryPrice) / entryPrice
        realizedEq += gross - COM
      }
      closeTrade('closed', i, slTpExitPx, slTpReason)
      side = 0
      barsInPos++
    } else if (side !== 0 && desired !== side) {
      // Strategy wants out or flip. Close at this bar's close.
      const r = side * (c[i].c / c[i - 1].c - 1)
      if (compound) {
        eq *= 1 + r - COM
      } else {
        const gross = side * (c[i].c - entryPrice) / entryPrice
        realizedEq += gross - COM
      }
      closeTrade('closed', i, c[i].c, 'signal')
      barsInPos++
      side = 0
      // If desired is non-zero, open new position at same bar's close
      if (desired !== 0) openPosition(i, desired, false)
    } else if (side !== 0 && desired === side) {
      // Stay in position. Capture bar return.
      const r = side * (c[i].c / c[i - 1].c - 1)
      if (compound) eq *= 1 + r
      barsInPos++
    } else if (side === 0 && desired !== 0) {
      // Fresh entry at bar i. Capture bar i's return (matches original convention).
      openPosition(i, desired, true)
    }
    // else: flat and stays flat — nothing to do

    if (compound) {
      eqArr.push(eq)
    } else {
      const floating = side !== 0 ? side * (c[i].c / entryPrice - 1) : 0
      eqArr.push(realizedEq + floating)
    }
    bhArr.push(bh)
  }

  if (side !== 0) {
    closeTrade('open', n - 1, c[n - 1].c, 'open')
  }

  const finalEq = compound
    ? eq
    : realizedEq + (side !== 0 ? side * (c[n - 1].c / entryPrice - 1) : 0)
  const total = (finalEq - 1) * 100
  const bhTotal = (bh - 1) * 100
  const ganadores = trades.filter(t => t.retNet > 0).length
  const mejor = trades.length ? trades.reduce((m, t) => t.retNet > m ? t.retNet : m, -Infinity) : 0
  const peor = trades.length ? trades.reduce((m, t) => t.retNet < m ? t.retNet : m, Infinity) : 0
  let pico = -Infinity, dd = 0
  eqArr.forEach(v => {
    pico = Math.max(pico, v)
    dd = Math.min(dd, (v - pico) / pico)
  })
  const enMercado = n > 0 ? barsInPos / n * 100 : 0

  return {
    eqArr, bhArr, trades,
    met: {
      total, bhTotal,
      ganadores, n: trades.length,
      mejor, peor,
      maxdd: dd * 100,
      enMercado,
    },
  }
}

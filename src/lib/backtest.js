export const STAKE = 1000 // default
export const COM = 0.0016 // 0.16% por operación (taker Kraken aprox.)

// posRaw[i] = signal computed from data through bar i.
// Convention (no look-ahead): a signal at bar i-1 takes effect at bar i.
// Intrabar SL/TP exits use the bar's high/low. If both could fire in the
// same bar we conservatively assume SL fired first.
//
// opts:
//   stopPct, takePct: % from entry, 0 = off
//   stake: starting capital in $ (default 1000)
//   compound: true (default) = reinvest profits; false = fixed stake per trade
export function backtest(c, posRaw, opts = {}) {
  const stopPct = Number(opts.stopPct) || 0
  const takePct = Number(opts.takePct) || 0
  const stake = Number(opts.stake) || STAKE
  const compound = opts.compound !== false
  const n = c.length

  const want = i => (i > 0 && posRaw[i - 1] === 1 ? 1 : 0)

  // Equity is tracked in units of `stake` (eq = 1 means starting capital).
  // In compound mode we multiply; in simple mode we add bar returns and
  // mark to market intrabar for unrealized P&L.
  let bh = 1
  const eqArr = [1], bhArr = [1]
  const trades = []

  // Compound state
  let eq = 1
  let entryEq = 1

  // Simple state
  let realizedEq = 1

  let inPos = false
  let entryIdx = -1, entryPrice = 0
  let barsInPos = 0

  const pushTrade = (kind, i, exitPx, gross, reason) => {
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
      ret: gross * 100,
      retNet: (gross - sides * COM) * 100,
      reason,
      qty, investedUSD, pnlUSD, feeUSD,
      sides,
    })
  }

  for (let i = 1; i < n; i++) {
    bh *= c[i].c / c[i - 1].c

    if (inPos) {
      barsInPos++
      const slLvl = stopPct > 0 ? entryPrice * (1 - stopPct / 100) : null
      const tpLvl = takePct > 0 ? entryPrice * (1 + takePct / 100) : null
      let exitPx = null, exitReason = null
      if (slLvl != null && c[i].l <= slLvl) {
        exitPx = slLvl
        exitReason = 'SL'
      } else if (tpLvl != null && c[i].h >= tpLvl) {
        exitPx = tpLvl
        exitReason = 'TP'
      }

      if (exitPx != null) {
        const gross = exitPx / entryPrice - 1
        if (compound) {
          const r = exitPx / c[i - 1].c - 1
          eq *= 1 + r - COM
        } else {
          realizedEq += gross - COM
        }
        pushTrade('closed', i, exitPx, gross, exitReason)
        inPos = false
      } else if (want(i) === 0) {
        const gross = c[i].c / entryPrice - 1
        if (compound) {
          const r = c[i].c / c[i - 1].c - 1
          eq *= 1 + r - COM
        } else {
          realizedEq += gross - COM
        }
        pushTrade('closed', i, c[i].c, gross, 'signal')
        inPos = false
      } else {
        if (compound) {
          const r = c[i].c / c[i - 1].c - 1
          eq *= 1 + r
        }
        // simple: realizedEq stays; mark-to-market handled below
      }
    } else if (want(i) === 1) {
      if (compound) {
        const r = c[i].c / c[i - 1].c - 1
        eq *= 1 + r - COM
        entryEq = eq
      } else {
        realizedEq -= COM
      }
      inPos = true
      entryIdx = i
      entryPrice = c[i].c
      barsInPos++
    }

    if (compound) {
      eqArr.push(eq)
    } else {
      // mark to market: realized + floating P&L from current open position
      const floating = inPos ? c[i].c / entryPrice - 1 : 0
      eqArr.push(realizedEq + floating)
    }
    bhArr.push(bh)
  }

  if (inPos) {
    const gross = c[n - 1].c / entryPrice - 1
    pushTrade('open', n - 1, c[n - 1].c, gross, 'open')
  }

  const finalEq = compound ? eq : realizedEq + (inPos ? c[n - 1].c / entryPrice - 1 : 0)
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

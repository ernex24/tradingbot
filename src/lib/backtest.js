export const STAKE = 1000
export const COM = 0.0016 // 0.16% por operación (taker Kraken aprox.)

// posRaw[i] = signal computed from data through bar i.
// Convention (no look-ahead): a signal at bar i-1 takes effect at bar i.
// Intrabar SL/TP exits use the bar's high/low. If both could fire in the
// same bar we conservatively assume SL fired first.
export function backtest(c, posRaw, opts = {}) {
  const stopPct = Number(opts.stopPct) || 0
  const takePct = Number(opts.takePct) || 0
  const n = c.length

  const want = i => (i > 0 && posRaw[i - 1] === 1 ? 1 : 0)

  let eq = 1, bh = 1
  const eqArr = [1], bhArr = [1]
  const trades = []
  let inPos = false
  let entryIdx = -1, entryPrice = 0, entryEq = 1
  let barsInPos = 0

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
        const r = exitPx / c[i - 1].c - 1
        eq *= 1 + r - COM
        const gross = exitPx / entryPrice - 1
        const investedUSD = entryEq * STAKE
        const qty = investedUSD / entryPrice
        const pnlUSD = investedUSD * (gross - 2 * COM)
        trades.push({
          ci: entryIdx, cf: c[entryIdx].f, cp: entryPrice,
          vi: i, vf: c[i].f, vp: exitPx,
          ret: gross * 100,
          retNet: (gross - 2 * COM) * 100,
          reason: exitReason,
          qty, investedUSD, pnlUSD,
        })
        inPos = false
      } else if (want(i) === 0) {
        const r = c[i].c / c[i - 1].c - 1
        eq *= 1 + r - COM
        const gross = c[i].c / entryPrice - 1
        const investedUSD = entryEq * STAKE
        const qty = investedUSD / entryPrice
        const pnlUSD = investedUSD * (gross - 2 * COM)
        trades.push({
          ci: entryIdx, cf: c[entryIdx].f, cp: entryPrice,
          vi: i, vf: c[i].f, vp: c[i].c,
          ret: gross * 100,
          retNet: (gross - 2 * COM) * 100,
          reason: 'signal',
          qty, investedUSD, pnlUSD,
        })
        inPos = false
      } else {
        const r = c[i].c / c[i - 1].c - 1
        eq *= 1 + r
      }
    } else if (want(i) === 1) {
      const r = c[i].c / c[i - 1].c - 1
      eq *= 1 + r - COM
      inPos = true
      entryIdx = i
      entryPrice = c[i].c
      entryEq = eq
      barsInPos++
    }

    eqArr.push(eq)
    bhArr.push(bh)
  }

  if (inPos) {
    const gross = c[n - 1].c / entryPrice - 1
    const investedUSD = entryEq * STAKE
    const qty = investedUSD / entryPrice
    const pnlUSD = investedUSD * (gross - COM)
    trades.push({
      ci: entryIdx, cf: c[entryIdx].f, cp: entryPrice,
      vi: null, vf: null, vp: c[n - 1].c,
      ret: gross * 100,
      retNet: (gross - COM) * 100,
      reason: 'open',
      qty, investedUSD, pnlUSD,
    })
  }

  const total = (eq - 1) * 100
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

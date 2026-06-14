export const STAKE = 1000
export const COM = 0.0016 // 0.16% por operación (taker Kraken aprox.)

export function backtest(c, posRaw) {
  const n = c.length
  // operar al día siguiente (sin look-ahead)
  const pos = posRaw.map((_, i) => (i > 0 ? posRaw[i - 1] : 0))
  let eq = 1, bh = 1
  const eqArr = [], bhArr = []
  const trades = []
  let estado = 0, entrada = null

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const r = c[i].c / c[i - 1].c - 1
      eq *= 1 + pos[i] * r - Math.abs(pos[i] - pos[i - 1]) * COM
      bh *= 1 + r
    }
    eqArr.push(eq)
    bhArr.push(bh)
    if (pos[i] === 1 && estado === 0) {
      estado = 1
      entrada = { i, p: c[i].c }
    } else if (pos[i] === 0 && estado === 1) {
      estado = 0
      const gross = c[i].c / entrada.p - 1
      trades.push({
        ci: entrada.i, cf: c[entrada.i].f, cp: entrada.p,
        vi: i, vf: c[i].f, vp: c[i].c,
        ret: gross * 100,
        retNet: (gross - 2 * COM) * 100,
      })
    }
  }
  if (estado === 1) {
    const gross = c[n - 1].c / entrada.p - 1
    trades.push({
      ci: entrada.i, cf: c[entrada.i].f, cp: entrada.p,
      vi: null, vf: null, vp: c[n - 1].c,
      ret: gross * 100,
      retNet: (gross - COM) * 100, // open position: only entry commission so far
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
  const enMercado = pos.reduce((a, b) => a + b, 0) / n * 100

  return {
    pos, eqArr, bhArr, trades,
    met: {
      total, bhTotal,
      ganadores, n: trades.length,
      mejor, peor,
      maxdd: dd * 100,
      enMercado,
    },
  }
}

import { sma, rsi } from './indicators.js'

export const STRATS = {
  ma: {
    nombre: 'Moving average cross',
    params: [
      { k: 'corta', label: 'Short MA', def: 10, min: 2, max: 100 },
      { k: 'larga', label: 'Long MA', def: 30, min: 5, max: 200 },
    ],
    leyenda: p => ['MA' + p.corta, 'MA' + p.larga],
    validar: p => (p.corta >= p.larga
      ? 'Short MA must be smaller than long MA.'
      : null),
    run: (c, p) => {
      const close = c.map(x => x.c)
      const mc = sma(close, p.corta)
      const ml = sma(close, p.larga)
      const pos = close.map((_, i) =>
        mc[i] != null && ml[i] != null ? (mc[i] > ml[i] ? 1 : 0) : 0
      )
      return { pos, lines: { a: mc, b: ml } }
    },
  },

  rsi: {
    nombre: 'RSI · mean reversion',
    params: [
      { k: 'periodo', label: 'RSI period', def: 14, min: 2, max: 50 },
      { k: 'compra', label: 'Buy below', def: 35, min: 5, max: 50 },
      { k: 'venta', label: 'Sell above', def: 55, min: 50, max: 95 },
    ],
    leyenda: () => ['Price', '—'],
    validar: p => (p.compra >= p.venta
      ? 'Buy threshold must be lower than sell threshold.'
      : null),
    run: (c, p) => {
      const close = c.map(x => x.c)
      const r = rsi(close, p.periodo)
      const pos = new Array(close.length).fill(0)
      let dentro = 0
      for (let i = 0; i < close.length; i++) {
        if (r[i] == null) { pos[i] = 0; continue }
        if (dentro === 0 && r[i] < p.compra) dentro = 1
        else if (dentro === 1 && r[i] > p.venta) dentro = 0
        pos[i] = dentro
      }
      return {
        pos,
        lines: {
          a: sma(close, Math.max(5, Math.round(p.periodo / 2))),
          b: sma(close, p.periodo * 2),
        },
      }
    },
  },

  brk: {
    nombre: 'Breakout',
    params: [
      { k: 'lookback', label: 'Lookback', def: 20, min: 5, max: 80 },
    ],
    leyenda: p => ['High ' + p.lookback, 'Low ' + p.lookback],
    validar: () => null,
    run: (c, p) => {
      const close = c.map(x => x.c)
      const high = c.map(x => x.h)
      const low = c.map(x => x.l)
      const upper = close.map((_, i) =>
        i >= p.lookback ? Math.max(...high.slice(i - p.lookback, i)) : null
      )
      const lower = close.map((_, i) =>
        i >= p.lookback ? Math.min(...low.slice(i - p.lookback, i)) : null
      )
      const pos = new Array(close.length).fill(0)
      let dentro = 0
      for (let i = 0; i < close.length; i++) {
        if (upper[i] == null) { pos[i] = 0; continue }
        if (dentro === 0 && close[i] > upper[i]) dentro = 1
        else if (dentro === 1 && close[i] < lower[i]) dentro = 0
        pos[i] = dentro
      }
      return { pos, lines: { a: upper, b: lower } }
    },
  },

  hold: {
    nombre: 'Buy and hold',
    params: [],
    leyenda: () => ['Price', '—'],
    validar: () => null,
    run: c => ({
      pos: new Array(c.length).fill(1),
      lines: { a: [], b: [] },
    }),
  },
}

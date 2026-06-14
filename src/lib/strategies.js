import { sma, rsi } from './indicators.js'

export const STRATS = {
  ma: {
    nombre: 'Cruce de medias',
    params: [
      { k: 'corta', label: 'Media corta', def: 10, min: 2, max: 100 },
      { k: 'larga', label: 'Media larga', def: 30, min: 5, max: 200 },
    ],
    leyenda: p => ['MA' + p.corta, 'MA' + p.larga],
    validar: p => (p.corta >= p.larga
      ? 'La media corta debe ser menor que la larga.'
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
    nombre: 'RSI · reversión',
    params: [
      { k: 'periodo', label: 'Periodo RSI', def: 14, min: 2, max: 50 },
      { k: 'compra', label: 'Compra bajo', def: 35, min: 5, max: 50 },
      { k: 'venta', label: 'Vende sobre', def: 55, min: 50, max: 95 },
    ],
    leyenda: () => ['Precio', '—'],
    validar: p => (p.compra >= p.venta
      ? 'El umbral de compra debe ser menor que el de venta.'
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
    nombre: 'Ruptura',
    params: [
      { k: 'lookback', label: 'Ventana', def: 20, min: 5, max: 80 },
    ],
    leyenda: p => ['Máx ' + p.lookback, 'Mín ' + p.lookback],
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
    nombre: 'Comprar y mantener',
    params: [],
    leyenda: () => ['Precio', '—'],
    validar: () => null,
    run: c => ({
      pos: new Array(c.length).fill(1),
      lines: { a: [], b: [] },
    }),
  },
}

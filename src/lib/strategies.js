import { sma, rsi } from './indicators.js'

// Direction modes:
//   'long'  → positions are 0 or +1
//   'short' → positions are 0 or -1
//   'both'  → positions are -1 or +1 (always in market once warmed up)
//
// run(candles, params, direction) returns { pos: number[], lines: {a, b} }

function applyDirection(signalLong, direction) {
  // signalLong[i] is 1 when "long signal active", 0 otherwise.
  // Translate to {-1, 0, +1} per direction.
  if (direction === 'long') return signalLong
  if (direction === 'short') return signalLong.map(v => (v === 1 ? 0 : -1))
  // 'both': long when signal active, short otherwise. -1 only after warmup.
  return signalLong.map(v => (v === 1 ? 1 : -1))
}

export const STRATS = {
  ma: {
    nombre: 'Moving average cross',
    description: 'Enters long when the fast moving average crosses above the slow one and exits when it crosses back below. Rides sustained trends well but tends to enter late and get whipsawed in sideways markets.',
    supportsDirection: true,
    params: [
      { k: 'corta', label: 'Short MA', def: 10, min: 2, max: 100 },
      { k: 'larga', label: 'Long MA', def: 30, min: 5, max: 200 },
    ],
    leyenda: p => ['MA' + p.corta, 'MA' + p.larga],
    validar: p => (p.corta >= p.larga
      ? 'Short MA must be smaller than long MA.'
      : null),
    run: (c, p, direction = 'long') => {
      const close = c.map(x => x.c)
      const mc = sma(close, p.corta)
      const ml = sma(close, p.larga)
      const signalLong = close.map((_, i) =>
        mc[i] != null && ml[i] != null ? (mc[i] > ml[i] ? 1 : 0) : 0
      )
      // For 'both', avoid -1 during warmup (when MAs aren't ready)
      const ready = i => mc[i] != null && ml[i] != null
      const pos = applyDirection(signalLong, direction).map((v, i) => ready(i) ? v : 0)
      return { pos, lines: { a: mc, b: ml } }
    },
  },

  rsi: {
    nombre: 'RSI · mean reversion',
    description: 'Buys when RSI drops below the oversold level, exits when RSI rises above the overbought level. Bets that price snaps back to its mean after extremes. Works in ranging markets, suffers in strong trends.',
    supportsDirection: true,
    params: [
      { k: 'periodo', label: 'RSI period', def: 14, min: 2, max: 50 },
      { k: 'compra', label: 'Buy below', def: 35, min: 5, max: 50 },
      { k: 'venta', label: 'Sell above', def: 55, min: 50, max: 95 },
    ],
    leyenda: () => ['Price', '—'],
    validar: p => (p.compra >= p.venta
      ? 'Buy threshold must be lower than sell threshold.'
      : null),
    run: (c, p, direction = 'long') => {
      const close = c.map(x => x.c)
      const r = rsi(close, p.periodo)
      const pos = new Array(close.length).fill(0)
      let estado = 0 // 1 = long-flavored signal active, 0 = not
      for (let i = 0; i < close.length; i++) {
        if (r[i] == null) { pos[i] = 0; continue }
        if (estado === 0 && r[i] < p.compra) estado = 1
        else if (estado === 1 && r[i] > p.venta) estado = 0
        if (direction === 'long') pos[i] = estado
        else if (direction === 'short') pos[i] = estado === 1 ? 0 : -1
        else pos[i] = estado === 1 ? 1 : -1 // 'both'
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
    description: 'Enters when price breaks above the highest high of the lookback window, exits when it breaks below the lowest low. Classic Donchian-style trend follower made famous by the Turtle Traders. Catches big moves but pays many small losses on false breakouts.',
    supportsDirection: true,
    params: [
      { k: 'lookback', label: 'Lookback', def: 20, min: 5, max: 80 },
    ],
    leyenda: p => ['High ' + p.lookback, 'Low ' + p.lookback],
    validar: () => null,
    run: (c, p, direction = 'long') => {
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
      let estado = 0
      for (let i = 0; i < close.length; i++) {
        if (upper[i] == null) { pos[i] = 0; continue }
        if (estado === 0 && close[i] > upper[i]) estado = 1
        else if (estado === 1 && close[i] < lower[i]) estado = 0
        if (direction === 'long') pos[i] = estado
        else if (direction === 'short') pos[i] = estado === 1 ? 0 : -1
        else pos[i] = estado === 1 ? 1 : -1 // 'both'
      }
      return { pos, lines: { a: upper, b: lower } }
    },
  },

  hold: {
    nombre: 'Buy and hold',
    description: 'Buys at the start of the period and holds until the end. No timing decisions. Use as the baseline to judge whether the other strategies actually beat doing nothing.',
    supportsDirection: false,
    params: [],
    leyenda: () => ['Price', '—'],
    validar: () => null,
    run: c => ({
      pos: new Array(c.length).fill(1),
      lines: { a: [], b: [] },
    }),
  },
}

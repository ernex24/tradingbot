export function sma(arr, w) {
  return arr.map((_, i) =>
    i >= w - 1 ? arr.slice(i - w + 1, i + 1).reduce((a, b) => a + b, 0) / w : null
  )
}

export function rsi(closes, period) {
  const out = new Array(closes.length).fill(null)
  let g = 0, l = 0
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const up = Math.max(d, 0)
    const dn = Math.max(-d, 0)
    if (i <= period) {
      g += up
      l += dn
      if (i === period) {
        g /= period
        l /= period
        out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
      }
    } else {
      g = (g * (period - 1) + up) / period
      l = (l * (period - 1) + dn) / period
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
    }
  }
  return out
}

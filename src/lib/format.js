export const usd = n => '$' + Math.round(n).toLocaleString('en-US')
export const usdPrecise = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const signed = n => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('en-US')
export const pct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
export const btc = n => n.toFixed(4) + ' BTC'

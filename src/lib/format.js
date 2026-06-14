export const usd = n => '$' + Math.round(n).toLocaleString('en-US')
export const signed = n => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString('en-US')
export const pct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

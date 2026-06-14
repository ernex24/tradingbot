export const usd = n => '$' + Math.round(n).toLocaleString('en-US')
export const usdPrecise = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const signed = n => {
  const sign = n >= 0 ? '+$' : '-$'
  return sign + Math.round(Math.abs(n)).toLocaleString('en-US')
}
export const pct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

// Price adapts decimals to the magnitude so SOL ($200), SUI ($3) and BTC ($60k) all read well.
export const price = n => {
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US')
  if (n >= 10) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })
}

// Quantity adapts decimals: 0.0241 BTC, 12.43 SOL, 4,521 SUI all read well.
export const qty = (n, symbol = '') => {
  let formatted
  if (n >= 1000) formatted = Math.round(n).toLocaleString('en-US')
  else if (n >= 1) formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  else formatted = n.toFixed(4)
  return symbol ? formatted + ' ' + symbol : formatted
}

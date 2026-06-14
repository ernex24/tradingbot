// Amount formatters. USDT is the quote currency on Binance Spot so we
// suffix monetary amounts with " USDT" rather than prefixing with "$".
// Asset prices (BTC, ETH, SOL) keep the "$" prefix via `price()` since
// that's the conventional way to read crypto prices.

export const usd = n => Math.round(n).toLocaleString('en-US') + ' USDT'
export const usdPrecise = n => n.toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}) + ' USDT'

export const signed = n => {
  const sign = n >= 0 ? '+' : '-'
  return sign + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' USDT'
}
export const pct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

// Adaptive asset price formatter.
export const price = n => {
  if (n >= 1000) return '$' + Math.round(n).toLocaleString('en-US')
  if (n >= 10) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })
}

export const qty = (n, symbol = '') => {
  let formatted
  if (n >= 1000) formatted = Math.round(n).toLocaleString('en-US')
  else if (n >= 1) formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  else formatted = n.toFixed(4)
  return symbol ? formatted + ' ' + symbol : formatted
}

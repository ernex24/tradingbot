// Coin keys consumed by /api/ohlc. Each coin declares which exchanges
// can serve it, and the first one is the default when the coin is selected.
export const COINS = [
  { value: 'BTC', label: 'Bitcoin (BTC)', symbol: 'BTC', sources: ['binance', 'kraken'] },
  { value: 'ETH', label: 'Ethereum (ETH)', symbol: 'ETH', sources: ['binance', 'kraken'] },
  { value: 'SOL', label: 'Solana (SOL)', symbol: 'SOL', sources: ['binance', 'kraken'] },
  { value: 'SUI', label: 'Sui (SUI)', symbol: 'SUI', sources: ['binance', 'kraken'] },
  { value: 'HYPE', label: 'Hyperliquid (HYPE)', symbol: 'HYPE', sources: ['hyperliquid', 'kraken'] },
]

export const SOURCE_LABELS = {
  binance: 'Binance',
  kraken: 'Kraken',
  hyperliquid: 'Hyperliquid',
}

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

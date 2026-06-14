// Coin keys consumed by /api/ohlc. The proxy decides which exchange
// to source from (Binance for BTC/ETH/SOL/SUI, Hyperliquid for HYPE).
export const COINS = [
  { value: 'BTC', label: 'Bitcoin (BTC)', symbol: 'BTC' },
  { value: 'ETH', label: 'Ethereum (ETH)', symbol: 'ETH' },
  { value: 'SOL', label: 'Solana (SOL)', symbol: 'SOL' },
  { value: 'SUI', label: 'Sui (SUI)', symbol: 'SUI' },
  { value: 'HYPE', label: 'Hyperliquid (HYPE)', symbol: 'HYPE' },
]

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

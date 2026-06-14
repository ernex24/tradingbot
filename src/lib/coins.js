// Kraken pair codes paired with display labels.
export const COINS = [
  { value: 'XBTUSD', label: 'Bitcoin (BTC)', symbol: 'BTC' },
  { value: 'ETHUSD', label: 'Ethereum (ETH)', symbol: 'ETH' },
  { value: 'SOLUSD', label: 'Solana (SOL)', symbol: 'SOL' },
  { value: 'SUIUSD', label: 'Sui (SUI)', symbol: 'SUI' },
  { value: 'HYPEUSD', label: 'Hyperliquid (HYPE)', symbol: 'HYPE' },
]

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

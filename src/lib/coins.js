// Coins available on Binance Spot. All data and execution comes from Binance.
export const COINS = [
  { value: 'BTC', label: 'Bitcoin (BTC)', symbol: 'BTC' },
  { value: 'ETH', label: 'Ethereum (ETH)', symbol: 'ETH' },
  { value: 'SOL', label: 'Solana (SOL)', symbol: 'SOL' },
  { value: 'SUI', label: 'Sui (SUI)', symbol: 'SUI' },
]

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

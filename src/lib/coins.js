// Coins available on Binance Spot. All data and execution comes from Binance.
// `testnet` flag marks pairs known to exist on Binance Spot Testnet — those
// can be used by live Testnet bots; the rest are backtest-only.
export const COINS = [
  { value: 'BTC',   label: 'Bitcoin (BTC)',     symbol: 'BTC',   testnet: true  },
  { value: 'ETH',   label: 'Ethereum (ETH)',    symbol: 'ETH',   testnet: true  },
  { value: 'BNB',   label: 'BNB',               symbol: 'BNB',   testnet: true  },
  { value: 'SOL',   label: 'Solana (SOL)',      symbol: 'SOL',   testnet: true  },
  { value: 'XRP',   label: 'XRP',               symbol: 'XRP',   testnet: true  },
  { value: 'ADA',   label: 'Cardano (ADA)',     symbol: 'ADA',   testnet: true  },
  { value: 'DOGE',  label: 'Dogecoin (DOGE)',   symbol: 'DOGE',  testnet: true  },
  { value: 'LTC',   label: 'Litecoin (LTC)',    symbol: 'LTC',   testnet: true  },
  { value: 'LINK',  label: 'Chainlink (LINK)',  symbol: 'LINK',  testnet: true  },
  { value: 'DOT',   label: 'Polkadot (DOT)',    symbol: 'DOT',   testnet: true  },
  { value: 'AVAX',  label: 'Avalanche (AVAX)',  symbol: 'AVAX',  testnet: false },
  { value: 'TRX',   label: 'TRON (TRX)',        symbol: 'TRX',   testnet: false },
  { value: 'ATOM',  label: 'Cosmos (ATOM)',     symbol: 'ATOM',  testnet: false },
  { value: 'NEAR',  label: 'NEAR (NEAR)',       symbol: 'NEAR',  testnet: false },
  { value: 'SUI',   label: 'Sui (SUI)',         symbol: 'SUI',   testnet: false },
  { value: 'APT',   label: 'Aptos (APT)',       symbol: 'APT',   testnet: false },
  { value: 'INJ',   label: 'Injective (INJ)',   symbol: 'INJ',   testnet: false },
  { value: 'TIA',   label: 'Celestia (TIA)',    symbol: 'TIA',   testnet: false },
]

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

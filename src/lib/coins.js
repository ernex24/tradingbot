// Top 20 popular coins on Binance Spot Testnet (verified against
// /api/v3/exchangeInfo). All are USDT-quoted and tradeable, so every
// one can power a live Testnet bot.
export const COINS = [
  { value: 'BTC',   label: 'Bitcoin (BTC)',       symbol: 'BTC'   },
  { value: 'ETH',   label: 'Ethereum (ETH)',      symbol: 'ETH'   },
  { value: 'BNB',   label: 'BNB',                 symbol: 'BNB'   },
  { value: 'XRP',   label: 'XRP',                 symbol: 'XRP'   },
  { value: 'SOL',   label: 'Solana (SOL)',        symbol: 'SOL'   },
  { value: 'DOGE',  label: 'Dogecoin (DOGE)',     symbol: 'DOGE'  },
  { value: 'ADA',   label: 'Cardano (ADA)',       symbol: 'ADA'   },
  { value: 'AVAX',  label: 'Avalanche (AVAX)',    symbol: 'AVAX'  },
  { value: 'TRX',   label: 'TRON (TRX)',          symbol: 'TRX'   },
  { value: 'LINK',  label: 'Chainlink (LINK)',    symbol: 'LINK'  },
  { value: 'DOT',   label: 'Polkadot (DOT)',      symbol: 'DOT'   },
  { value: 'LTC',   label: 'Litecoin (LTC)',      symbol: 'LTC'   },
  { value: 'POL',   label: 'Polygon (POL)',       symbol: 'POL'   },
  { value: 'SHIB',  label: 'Shiba Inu (SHIB)',    symbol: 'SHIB'  },
  { value: 'UNI',   label: 'Uniswap (UNI)',       symbol: 'UNI'   },
  { value: 'ATOM',  label: 'Cosmos (ATOM)',       symbol: 'ATOM'  },
  { value: 'NEAR',  label: 'NEAR Protocol',       symbol: 'NEAR'  },
  { value: 'APT',   label: 'Aptos (APT)',         symbol: 'APT'   },
  { value: 'SUI',   label: 'Sui (SUI)',           symbol: 'SUI'   },
  { value: 'PEPE',  label: 'Pepe (PEPE)',         symbol: 'PEPE'  },
]

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

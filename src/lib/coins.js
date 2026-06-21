// Coins available to the bot. `networks` lists where the USDT pair
// is actually tradeable — the testnet button is disabled for any
// coin whose `networks` doesn't include 'testnet'. Default when
// omitted is both, for backwards compatibility with older configs.
export const COINS = [
  // Majors — live on both Binance Spot Testnet and Mainnet
  { value: 'BTC',   label: 'Bitcoin (BTC)',       symbol: 'BTC',   networks: ['testnet', 'mainnet'] },
  { value: 'ETH',   label: 'Ethereum (ETH)',      symbol: 'ETH',   networks: ['testnet', 'mainnet'] },
  { value: 'BNB',   label: 'BNB',                 symbol: 'BNB',   networks: ['testnet', 'mainnet'] },
  { value: 'XRP',   label: 'XRP',                 symbol: 'XRP',   networks: ['testnet', 'mainnet'] },
  { value: 'SOL',   label: 'Solana (SOL)',        symbol: 'SOL',   networks: ['testnet', 'mainnet'] },
  { value: 'DOGE',  label: 'Dogecoin (DOGE)',     symbol: 'DOGE',  networks: ['testnet', 'mainnet'] },
  { value: 'ADA',   label: 'Cardano (ADA)',       symbol: 'ADA',   networks: ['testnet', 'mainnet'] },
  { value: 'AVAX',  label: 'Avalanche (AVAX)',    symbol: 'AVAX',  networks: ['testnet', 'mainnet'] },
  { value: 'TRX',   label: 'TRON (TRX)',          symbol: 'TRX',   networks: ['testnet', 'mainnet'] },
  { value: 'LINK',  label: 'Chainlink (LINK)',    symbol: 'LINK',  networks: ['testnet', 'mainnet'] },
  { value: 'DOT',   label: 'Polkadot (DOT)',      symbol: 'DOT',   networks: ['testnet', 'mainnet'] },
  { value: 'LTC',   label: 'Litecoin (LTC)',      symbol: 'LTC',   networks: ['testnet', 'mainnet'] },
  { value: 'POL',   label: 'Polygon (POL)',       symbol: 'POL',   networks: ['testnet', 'mainnet'] },
  { value: 'SHIB',  label: 'Shiba Inu (SHIB)',    symbol: 'SHIB',  networks: ['testnet', 'mainnet'] },
  { value: 'UNI',   label: 'Uniswap (UNI)',       symbol: 'UNI',   networks: ['testnet', 'mainnet'] },
  { value: 'ATOM',  label: 'Cosmos (ATOM)',       symbol: 'ATOM',  networks: ['testnet', 'mainnet'] },
  { value: 'NEAR',  label: 'NEAR Protocol',       symbol: 'NEAR',  networks: ['testnet', 'mainnet'] },
  { value: 'APT',   label: 'Aptos (APT)',         symbol: 'APT',   networks: ['testnet', 'mainnet'] },
  { value: 'SUI',   label: 'Sui (SUI)',           symbol: 'SUI',   networks: ['testnet', 'mainnet'] },
  { value: 'PEPE',  label: 'Pepe (PEPE)',         symbol: 'PEPE',  networks: ['testnet', 'mainnet'] },

  // Mainnet-only additions (not on testnet.binance.vision exchangeInfo)
  { value: 'TON',   label: 'Toncoin (TON)',       symbol: 'TON',   networks: ['mainnet'] },
  { value: 'ARB',   label: 'Arbitrum (ARB)',      symbol: 'ARB',   networks: ['mainnet'] },
  { value: 'OP',    label: 'Optimism (OP)',       symbol: 'OP',    networks: ['mainnet'] },
  { value: 'AAVE',  label: 'Aave (AAVE)',         symbol: 'AAVE',  networks: ['mainnet'] },
  { value: 'FIL',   label: 'Filecoin (FIL)',      symbol: 'FIL',   networks: ['mainnet'] },
  { value: 'ICP',   label: 'Internet Computer',   symbol: 'ICP',   networks: ['mainnet'] },

  // Privacy-flavoured. DASH is still on Binance Spot globally; XMR was
  // delisted globally in Feb 2024 and is intentionally NOT included.
  { value: 'DASH',  label: 'Dash (DASH)',         symbol: 'DASH',  networks: ['mainnet'] },
]

export function coinByPair(pair) {
  return COINS.find(c => c.value === pair) || COINS[0]
}

export function coinAvailableOn(coin, network) {
  if (!coin) return false
  const list = coin.networks || ['testnet', 'mainnet']
  return list.includes(network)
}

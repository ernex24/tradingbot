// Shared Binance order pre-flight helpers.
// Used by /api/cron/tick.js and /api/binance/[action].js so that
// every order — automatic (cron) or manual (Close now button) —
// goes through the same wallet-balance + LOT_SIZE / NOTIONAL gates.

import { binanceSigned } from './binanceSign.js'

const MAINNET = 'https://api.binance.com'
const TESTNET = 'https://testnet.binance.vision'

// Per-process per-symbol exchangeInfo cache. exchangeInfo rarely
// changes, so a cold-start refresh is fine.
const filterCache = new Map() // `${testnet?'t':'m'}-${symbol}` -> filters

export async function loadFilters(testnet, symbol) {
  const key = `${testnet ? 't' : 'm'}-${symbol}`
  if (filterCache.has(key)) return filterCache.get(key)
  const base = testnet ? TESTNET : MAINNET
  const r = await fetch(`${base}/api/v3/exchangeInfo?symbol=${symbol}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) throw new Error(`exchangeInfo HTTP ${r.status}`)
  const data = await r.json()
  const info = (data.symbols || [])[0]
  if (!info) throw new Error(`exchangeInfo: no symbol ${symbol}`)
  const lot = info.filters.find(f => f.filterType === 'LOT_SIZE')
  const notional = info.filters.find(f => f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL')
  const filters = {
    stepSize: +(lot?.stepSize || '0.00000001'),
    minQty: +(lot?.minQty || '0'),
    minNotional: +(notional?.minNotional || '0'),
  }
  filterCache.set(key, filters)
  return filters
}

export async function loadAssetBalance(creds, testnet, asset) {
  const account = await binanceSigned({
    apiKey: creds.apiKey, apiSecret: creds.apiSecret, testnet,
    path: '/api/v3/account',
  })
  const b = (account?.balances || []).find(x => x.asset === asset)
  return b ? +b.free : 0
}

// Floor `qty` to a multiple of `stepSize`, formatted with the right
// number of decimals so Binance's LOT_SIZE filter accepts it without
// floating-point noise. e.g. stepRoundDown(0.01598, 0.001) -> "0.015".
export function stepRoundDown(qty, stepSize) {
  if (!stepSize || stepSize <= 0) return String(qty)
  const steps = Math.floor(qty / stepSize)
  const value = steps * stepSize
  const decimals = Math.max(0, Math.round(-Math.log10(stepSize)))
  return value.toFixed(decimals)
}

export function baseAssetOf(symbol) {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol
}

// Returns a quantity string ready to send to Binance, or throws a
// descriptive error if the request can't be satisfied.
export async function prepareSell({
  creds, testnet, symbol, wantQty, currentPrice,
}) {
  const filters = await loadFilters(testnet, symbol)
  const base = baseAssetOf(symbol)
  const walletFree = await loadAssetBalance(creds, testnet, base)
  const capped = Math.min(+wantQty, walletFree)
  const qtyStr = stepRoundDown(capped, filters.stepSize)
  const qtyNum = +qtyStr
  if (qtyNum <= 0) {
    throw new Error(`Cannot SELL ${base}: wallet free is ${walletFree} (asked for ${wantQty})`)
  }
  if (qtyNum < filters.minQty) {
    throw new Error(`Cannot SELL ${qtyNum} ${base}: below symbol minQty ${filters.minQty} (wallet free: ${walletFree})`)
  }
  if (currentPrice && qtyNum * currentPrice < filters.minNotional) {
    throw new Error(`Cannot SELL ${qtyNum} ${base} ≈ ${(qtyNum * currentPrice).toFixed(2)} USDT: below symbol minNotional ${filters.minNotional}`)
  }
  return qtyStr
}

export async function prepareBuy({
  creds, testnet, symbol, plannedQuote,
}) {
  const filters = await loadFilters(testnet, symbol)
  const usdtFree = await loadAssetBalance(creds, testnet, 'USDT')
  // Hold back 0.1% for the fee on the BUY side so we never over-spend.
  const cappedQuote = Math.min(+plannedQuote, usdtFree * 0.999)
  if (cappedQuote < filters.minNotional) {
    throw new Error(`Cannot BUY: ${cappedQuote.toFixed(2)} USDT below symbol minNotional ${filters.minNotional} (wallet free: ${usdtFree.toFixed(2)})`)
  }
  return cappedQuote.toFixed(2)
}

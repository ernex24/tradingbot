// Unified OHLC proxy. Picks the right exchange per coin and normalizes
// the response to [{t, o, h, l, c}, ...] so the frontend doesn't care
// which source it came from.
//
// Binance Spot covers BTC, ETH, SOL, SUI.
// HYPE (Hyperliquid) isn't on Binance Spot — pulled from Hyperliquid's
// own public info API.
//
// Only reads public market data. No keys, no accounts.

const COINS = {
  BTC: { source: 'binance', symbol: 'BTCUSDT' },
  ETH: { source: 'binance', symbol: 'ETHUSDT' },
  SOL: { source: 'binance', symbol: 'SOLUSDT' },
  SUI: { source: 'binance', symbol: 'SUIUSDT' },
  HYPE: { source: 'hyperliquid', symbol: 'HYPE' },
}

const ALLOWED_INTERVALS = ['5m', '15m', '1h', '4h', '1d']
const TARGET_CANDLES = 3000

const INTERVAL_MS = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
}

export default async function handler(req, res) {
  const coinKey = String(req.query.coin || 'BTC').toUpperCase()
  const interval = String(req.query.interval || '1d')

  const coin = COINS[coinKey]
  if (!coin || !ALLOWED_INTERVALS.includes(interval)) {
    res.status(400).json({ error: 'parameters not allowed' })
    return
  }

  try {
    const candles =
      coin.source === 'binance'
        ? await fetchBinance(coin.symbol, interval)
        : await fetchHyperliquid(coin.symbol, interval)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.status(200).json({
      coin: coinKey,
      interval,
      source: coin.source,
      count: candles.length,
      candles,
    })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

async function fetchBinance(symbol, interval) {
  const all = []
  let endTime = Date.now()
  for (let i = 0; i < 5; i++) {
    if (all.length >= TARGET_CANDLES) break
    const limit = Math.min(1000, TARGET_CANDLES - all.length)
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&endTime=${endTime}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'trend-bot/1.0' },
      signal: AbortSignal.timeout(7000),
    })
    if (!r.ok) throw new Error('Binance HTTP ' + r.status)
    const batch = await r.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.unshift(...batch.map(row => ({
      t: +row[0],
      o: +row[1], h: +row[2], l: +row[3], c: +row[4],
    })))
    if (batch.length < limit) break
    endTime = batch[0][0] - 1
  }
  return all
}

async function fetchHyperliquid(coin, interval) {
  const ms = INTERVAL_MS[interval]
  const endTime = Date.now()
  const startTime = endTime - ms * TARGET_CANDLES
  const r = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    }),
    signal: AbortSignal.timeout(7000),
  })
  if (!r.ok) throw new Error('Hyperliquid HTTP ' + r.status)
  const batch = await r.json()
  if (!Array.isArray(batch)) throw new Error('Hyperliquid unexpected response')
  return batch.map(row => ({
    t: row.t,
    o: +row.o, h: +row.h, l: +row.l, c: +row.c,
  }))
}

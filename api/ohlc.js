// Unified OHLC proxy. Picks the right exchange per coin (or honours the
// caller's source override) and normalizes the response to
// [{t, o, h, l, c}, ...] so the frontend doesn't care which source it came from.
//
// Sources:
//   binance      — Spot, deep history (up to ~3000 candles via pagination)
//   kraken       — Single call, max 720 candles
//   hyperliquid  — HYPE only; pulled from their public info API
//
// Only reads public market data. No keys, no accounts.

const BINANCE_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', SUI: 'SUIUSDT',
}
const KRAKEN_SYMBOLS = {
  BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', SUI: 'SUIUSD', HYPE: 'HYPEUSD',
}
const HYPERLIQUID_SYMBOLS = {
  HYPE: 'HYPE',
}

// Default source per coin if caller didn't specify.
const DEFAULT_SOURCE = {
  BTC: 'binance', ETH: 'binance', SOL: 'binance', SUI: 'binance',
  HYPE: 'hyperliquid',
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
const KRAKEN_MINUTES = {
  '5m': 5, '15m': 15, '1h': 60, '4h': 240, '1d': 1440,
}

export default async function handler(req, res) {
  const coinKey = String(req.query.coin || 'BTC').toUpperCase()
  const interval = String(req.query.interval || '1d')
  const source = String(req.query.source || DEFAULT_SOURCE[coinKey] || 'binance').toLowerCase()

  if (!ALLOWED_INTERVALS.includes(interval)) {
    res.status(400).json({ error: 'interval not allowed' })
    return
  }

  try {
    let candles
    if (source === 'binance') {
      const symbol = BINANCE_SYMBOLS[coinKey]
      if (!symbol) throw new Error(`${coinKey} not available on Binance`)
      candles = await fetchBinance(symbol, interval)
    } else if (source === 'kraken') {
      const symbol = KRAKEN_SYMBOLS[coinKey]
      if (!symbol) throw new Error(`${coinKey} not available on Kraken`)
      candles = await fetchKraken(symbol, interval)
    } else if (source === 'hyperliquid') {
      const symbol = HYPERLIQUID_SYMBOLS[coinKey]
      if (!symbol) throw new Error(`${coinKey} not available on Hyperliquid`)
      candles = await fetchHyperliquid(symbol, interval)
    } else {
      res.status(400).json({ error: 'unknown source' })
      return
    }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.status(200).json({
      coin: coinKey,
      interval,
      source,
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

async function fetchKraken(symbol, interval) {
  const minutes = KRAKEN_MINUTES[interval]
  if (!minutes) throw new Error('Kraken: interval not supported')
  const url = `https://api.kraken.com/0/public/OHLC?pair=${symbol}&interval=${minutes}`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'trend-bot/1.0' },
    signal: AbortSignal.timeout(7000),
  })
  if (!r.ok) throw new Error('Kraken HTTP ' + r.status)
  const data = await r.json()
  if (data.error && data.error.length) throw new Error('Kraken: ' + data.error.join(', '))
  const key = Object.keys(data.result).find(k => k !== 'last')
  const rows = data.result[key]
  return rows.map(row => ({
    t: +row[0] * 1000,
    o: +row[1], h: +row[2], l: +row[3], c: +row[4],
  }))
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

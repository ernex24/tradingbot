// OHLC proxy for Binance Spot. Returns up to ~3000 candles per call by
// paginating /api/v3/klines via endTime. Public market data only.

const BINANCE_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', BNB: 'BNBUSDT', SOL: 'SOLUSDT',
  XRP: 'XRPUSDT', ADA: 'ADAUSDT', DOGE: 'DOGEUSDT', LTC: 'LTCUSDT',
  LINK: 'LINKUSDT', DOT: 'DOTUSDT', AVAX: 'AVAXUSDT', TRX: 'TRXUSDT',
  ATOM: 'ATOMUSDT', NEAR: 'NEARUSDT', SUI: 'SUIUSDT', APT: 'APTUSDT',
  INJ: 'INJUSDT', TIA: 'TIAUSDT',
}
const ALLOWED_INTERVALS = ['5m', '15m', '1h', '4h', '1d']
const TARGET_CANDLES = 3000

export default async function handler(req, res) {
  const coinKey = String(req.query.coin || 'BTC').toUpperCase()
  const interval = String(req.query.interval || '1d')

  if (!ALLOWED_INTERVALS.includes(interval)) {
    res.status(400).json({ error: 'interval not allowed' })
    return
  }
  const symbol = BINANCE_SYMBOLS[coinKey]
  if (!symbol) {
    res.status(400).json({ error: `${coinKey} not available on Binance` })
    return
  }

  try {
    const candles = await fetchBinance(symbol, interval)
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.status(200).json({
      coin: coinKey,
      interval,
      source: 'binance',
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

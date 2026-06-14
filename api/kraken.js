// Proxy serverless para la API pública de Kraken.
// Evita problemas de CORS y oculta el origen del navegador.
// Endpoint desplegado: /api/kraken?pair=XBTUSD&interval=1440
//
// Solo lee datos públicos de mercado. No usa claves ni toca cuentas.

export default async function handler(req, res) {
  const pair = (req.query.pair || 'XBTUSD').toString();
  const interval = (req.query.interval || '1440').toString();

  const allowedPairs = ['XBTUSD', 'ETHUSD', 'SOLUSD', 'SUIUSD', 'HYPEUSD'];
  const allowedIntervals = ['60', '240', '1440'];
  if (!allowedPairs.includes(pair) || !allowedIntervals.includes(interval)) {
    res.status(400).json({ error: ['parámetros no permitidos'] });
    return;
  }

  try {
    const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'trend-bot/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();

    if (!r.ok || (data.error && data.error.length)) {
      res.status(r.ok ? 502 : r.status).json(data);
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: ['no se pudo contactar a Kraken', String(e)] });
  }
}

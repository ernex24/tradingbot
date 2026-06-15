// GET /api/myip
// Returns the outbound IP this serverless function uses when making
// requests to external services like Binance. Use it to fill the
// "trusted IPs" field on a Binance API key.
//
// Tries multiple IP-detection services in case one is unavailable.

const PROBES = [
  'https://api.ipify.org?format=json',
  'https://ifconfig.me/all.json',
  'https://api.myip.com',
]

export default async function handler(req, res) {
  for (const url of PROBES) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!r.ok) continue
      const data = await r.json()
      const ip = data.ip || data.ip_addr || data.address
      if (ip) {
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({
          ip,
          source: url,
          region: process.env.VERCEL_REGION || null,
          note: 'Whitelist this IP on your Binance API key. Vercel function IPs are NOT guaranteed static — if Binance rejects again later, hit this endpoint to find the new one.',
        })
      }
    } catch { /* try next */ }
  }
  res.status(502).json({ error: 'all IP probes failed' })
}

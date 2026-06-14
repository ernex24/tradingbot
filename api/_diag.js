// Temporary diagnostic endpoint. Returns presence (not values) of the
// env vars the server functions need. Open in a browser:
//   https://trading-bot-mu-lemon.vercel.app/api/_diag
// Remove this file once auth is confirmed working.

export default function handler(req, res) {
  const url = process.env.SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || ''
  const role = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const enc = process.env.ENCRYPTION_KEY || ''
  res.status(200).json({
    SUPABASE_URL: {
      present: !!url,
      length: url.length,
      // The host helps confirm it points to the right Supabase project.
      // Only the subdomain (no secrets here).
      host: url ? url.replace(/^https?:\/\//, '').split('.')[0] : null,
    },
    SUPABASE_ANON_KEY: {
      present: !!anon,
      length: anon.length,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: !!role,
      length: role.length,
    },
    ENCRYPTION_KEY: {
      present: !!enc,
      length: enc.length,
      // 64 hex = 32 bytes, the expected length
      valid_length: enc.length === 64,
    },
    node: process.version,
    vercel_env: process.env.VERCEL_ENV || null,
  })
}

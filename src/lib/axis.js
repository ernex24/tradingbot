const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Accepts either 'YYYY-MM-DD' (daily) or 'YYYY-MM-DD HH:mm' (intraday).
export function shortDate(s) {
  if (!s) return ''
  const [date, time] = s.split(' ')
  const parts = date.split('-')
  if (parts.length < 3) return s
  const mes = MONTHS[+parts[1] - 1] ?? parts[1]
  const day = +parts[2]
  if (!time) return `${mes} ${day}`
  return `${mes} ${day} ${time.slice(0, 2)}h`
}

export function dateWithYear(s) {
  if (!s) return ''
  const [date, time] = s.split(' ')
  const [y, m, d] = date.split('-')
  const mes = MONTHS[+m - 1] ?? m
  if (!time) return `${mes} ${+d}, ${y}`
  return `${mes} ${+d}, ${y} ${time.slice(0, 5)}`
}

// Pick ~`count` evenly spaced indices spanning [0, n-1].
export function tickIndices(n, count = 6) {
  if (n <= 0) return []
  if (n <= count) return Array.from({ length: n }, (_, i) => i)
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(Math.round(i * (n - 1) / (count - 1)))
  }
  return out
}

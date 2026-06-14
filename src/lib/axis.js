const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDate(iso) {
  // iso: 'YYYY-MM-DD'
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  const mes = MONTHS[+m - 1] ?? m
  return `${mes} ${+d}`
}

export function dateWithYear(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const mes = MONTHS[+m - 1] ?? m
  return `${mes} ${+d}, ${y}`
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

const W = 1180
const H = 360
const PAD = { t: 14, r: 8, b: 8, l: 8 }

function linePath(arr, X, Y) {
  let d = ''
  let pen = false
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (v == null) { pen = false; continue }
    d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '
    pen = true
  }
  return d.trim()
}

export default function PriceChart({ candles, lines, trades }) {
  const n = candles.length
  const allv = candles.flatMap(c => [c.h, c.l])
    .concat(lines.a.filter(v => v != null))
    .concat(lines.b.filter(v => v != null))
  const min = Math.min(...allv)
  const max = Math.max(...allv)
  const padv = (max - min) * 0.04
  const X = i => PAD.l + (i + 0.5) / n * (W - PAD.l - PAD.r)
  const Y = v => PAD.t + (1 - (v - (min - padv)) / ((max + padv) - (min - padv))) * (H - PAD.t - PAD.b)
  const cw = Math.max(1.5, (W - PAD.l - PAD.r) / n * 0.62)

  return (
    <svg className="svg-price" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {trades.map((t, k) => {
        const x1 = X(t.ci)
        const x2 = t.vi != null ? X(t.vi) : X(n - 1)
        return (
          <rect key={`band-${k}`} x={x1.toFixed(1)} y={PAD.t}
            width={(x2 - x1).toFixed(1)} height={H - PAD.t - PAD.b}
            fill="#0156CE" opacity="0.045" />
        )
      })}
      {candles.map((c, i) => {
        const x = X(i)
        const up = c.c >= c.o
        const yo = Y(c.o), yc = Y(c.c), yh = Y(c.h), yl = Y(c.l)
        const top = Math.min(yo, yc)
        const bh = Math.max(2, Math.abs(yc - yo))
        return (
          <g key={`c-${i}`}>
            <line x1={x.toFixed(1)} y1={yh.toFixed(1)} x2={x.toFixed(1)} y2={yl.toFixed(1)}
              stroke="#0a0a0a" strokeWidth="1" />
            <rect x={(x - cw / 2).toFixed(1)} y={top.toFixed(1)}
              width={cw.toFixed(1)} height={bh.toFixed(1)}
              fill={up ? '#ffffff' : '#0a0a0a'}
              stroke="#0a0a0a" strokeWidth="1" />
          </g>
        )
      })}
      {lines.a.some(v => v != null) && (
        <path d={linePath(lines.a, X, Y)} fill="none" stroke="#0156CE" strokeWidth="1.5" />
      )}
      {lines.b.some(v => v != null) && (
        <path d={linePath(lines.b, X, Y)} fill="none" stroke="#9aa0a6" strokeWidth="1.5" />
      )}
      {trades.map((t, k) => {
        const xb = X(t.ci), yb = Y(t.cp)
        const buy = <path d={`M${xb} ${yb + 16} l-6 11 l12 0 z`} fill="#1b7a4b" />
        if (t.vi == null) return <g key={`m-${k}`}>{buy}</g>
        const xs = X(t.vi), ys = Y(t.vp)
        return (
          <g key={`m-${k}`}>
            {buy}
            <path d={`M${xs} ${ys - 16} l-6 -11 l12 0 z`} fill="#c0392b" />
          </g>
        )
      })}
    </svg>
  )
}

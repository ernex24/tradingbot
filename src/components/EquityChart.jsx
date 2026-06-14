import { STAKE } from '../lib/backtest.js'

const W = 1180
const H = 200
const PAD = { t: 14, r: 8, b: 8, l: 8 }

export default function EquityChart({ eqArr, bhArr }) {
  const eq = eqArr.map(v => v * STAKE)
  const bh = bhArr.map(v => v * STAKE)
  const all = eq.concat(bh)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const X = i => PAD.l + i / (eq.length - 1) * (W - PAD.l - PAD.r)
  const Y = v => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b)
  const p = arr => arr.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')
  const y0 = Y(STAKE)

  return (
    <svg className="svg-equity" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={PAD.l} y1={y0.toFixed(1)} x2={W - PAD.r} y2={y0.toFixed(1)}
        stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3 3" />
      <path d={p(bh)} fill="none" stroke="#6b6b6b" strokeWidth="1.2" opacity="0.6" />
      <path d={p(eq)} fill="none" stroke="#0156CE" strokeWidth="1.8" />
    </svg>
  )
}

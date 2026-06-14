import { STAKE } from '../lib/backtest.js'
import { shortDate, tickIndices } from '../lib/axis.js'

const W = 1180
const H = 220
const PAD = { t: 14, r: 8, b: 30, l: 8 }

export default function EquityChart({ eqArr, bhArr, candles = [] }) {
  const eq = eqArr.map(v => v * STAKE)
  const bh = bhArr.map(v => v * STAKE)
  const all = eq.concat(bh)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const X = i => PAD.l + i / (eq.length - 1) * (W - PAD.l - PAD.r)
  const Y = v => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b)
  const p = arr => arr.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')
  const y0 = Y(STAKE)
  const ticks = tickIndices(eq.length, 7)

  return (
    <svg className="svg-equity" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={PAD.l} y1={y0.toFixed(1)} x2={W - PAD.r} y2={y0.toFixed(1)}
        stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3 3" />
      <path d={p(bh)} fill="none" stroke="#6b6b6b" strokeWidth="1.2" opacity="0.6" />
      <path d={p(eq)} fill="none" stroke="#0156CE" strokeWidth="1.8" />

      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b}
        stroke="#e5e5e5" strokeWidth="1" />
      {ticks.map(i => (
        <g key={`etk-${i}`}>
          <line x1={X(i)} y1={H - PAD.b} x2={X(i)} y2={H - PAD.b + 4}
            stroke="#9aa0a6" strokeWidth="1" />
          <text x={X(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="11"
            fontFamily="var(--font, sans-serif)" fill="#6b6b6b">
            {shortDate(candles[i]?.f)}
          </text>
        </g>
      ))}
    </svg>
  )
}

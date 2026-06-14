import { useRef, useState } from 'react'
import { shortDate, tickIndices } from '../lib/axis.js'
import { price, usdPrecise, signed, pct, qty as fmtQty } from '../lib/format.js'

const W = 1180
const DEFAULT_H = 380
const PAD = { t: 14, r: 8, b: 32, l: 8 }

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

function isShortSide(side) {
  return side === 'short' || side === -1
}

function TradeTooltip({ trade, symbol }) {
  const isShort = isShortSide(trade.side)
  const isOpen = trade.vi == null && trade.reason === 'open'
  const float = isOpen && trade.investedUSD != null
    ? trade.investedUSD * (isShort ? -1 : 1) * (trade.vp - trade.cp) / trade.cp
    : null
  return (
    <div className="tt-content">
      <div className="tt-head">
        <span className={`tag ${isShort ? 'tag-short' : 'tag-long'}`}>
          {isShort ? 'SHORT' : 'LONG'}
        </span>
        {isOpen && <span className="tag tag-open" style={{ marginLeft: 4 }}>OPEN</span>}
        {trade.reason === 'SL' && <span className="tag tag-sl" style={{ marginLeft: 4 }}>SL</span>}
        {trade.reason === 'TP' && <span className="tag tag-tp" style={{ marginLeft: 4 }}>TP</span>}
      </div>
      <div className="tt-grid">
        <div>Entry</div>
        <div className="num">{trade.cf} · {price(trade.cp)}</div>

        {trade.qty != null && (
          <>
            <div>Size</div>
            <div className="num">
              {fmtQty(trade.qty, symbol)} · {usdPrecise(trade.investedUSD)}
            </div>
          </>
        )}

        {trade.vi != null && (
          <>
            <div>Exit</div>
            <div className="num">{trade.vf} · {price(trade.vp)}</div>
          </>
        )}

        {isOpen && trade.vp != null && (
          <>
            <div>Live</div>
            <div className="num">{price(trade.vp)}</div>
          </>
        )}

        {!isOpen && trade.pnlUSD != null && (
          <>
            <div>P&amp;L</div>
            <div className="num">
              <span className={trade.pnlUSD >= 0 ? 'pos' : 'neg'}>
                {signed(trade.pnlUSD)} ({pct(trade.retNet ?? 0)})
              </span>
              <div className="tt-sub">
                → {usdPrecise((trade.investedUSD ?? 0) + trade.pnlUSD)}
              </div>
            </div>
          </>
        )}

        {isOpen && float != null && (
          <>
            <div>Floating</div>
            <div className="num">
              <span className={float >= 0 ? 'pos' : 'neg'}>{signed(float)}</span>
              <div className="tt-sub">
                now {usdPrecise((trade.investedUSD ?? 0) + float)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PriceChart({ candles, lines, trades, height = DEFAULT_H, symbol = '' }) {
  const H = height
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
  const axisY = H - PAD.b + 4
  const ticks = tickIndices(n, 7)

  const wrapperRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  const handleEnter = (e, trade) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    setHovered({
      trade,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }
  const handleLeave = () => setHovered(null)

  return (
    <div ref={wrapperRef} className="chart-wrapper">
      <svg
        className="svg-price"
        style={{ height: `${H}px` }}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        {trades.map((t, k) => {
          const x1 = X(t.ci)
          const x2 = t.vi != null ? X(t.vi) : X(n - 1)
          const fill = isShortSide(t.side) ? '#c0392b' : '#0156CE'
          return (
            <rect key={`band-${k}`} x={x1.toFixed(1)} y={PAD.t}
              width={(x2 - x1).toFixed(1)} height={H - PAD.t - PAD.b}
              fill={fill} opacity="0.05" />
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
          const isShort = isShortSide(t.side)
          const xb = X(t.ci), yb = Y(t.cp)
          const entryColor = isShort ? '#c0392b' : '#1b7a4b'
          const entryGlyph = isShort
            ? <path d={`M${xb} ${yb - 16} l-6 -11 l12 0 z`} fill={entryColor} />
            : <path d={`M${xb} ${yb + 16} l-6 11 l12 0 z`} fill={entryColor} />
          const entryLabel = (
            <text x={xb} y={isShort ? yb - 32 : yb + 41} textAnchor="middle" fontSize="9"
              fontFamily="var(--font, sans-serif)" fill={entryColor}>
              {shortDate(candles[t.ci]?.f)}
            </text>
          )
          const entryMarker = (
            <g
              key={`mE-${k}`}
              style={{ cursor: 'help' }}
              onMouseEnter={e => handleEnter(e, t)}
              onMouseLeave={handleLeave}
            >
              {/* invisible larger hit area */}
              <circle cx={xb} cy={isShort ? yb - 20 : yb + 24} r="14" fill="transparent" />
              {entryGlyph}
              {entryLabel}
            </g>
          )
          if (t.vi == null) return entryMarker
          const xs = X(t.vi), ys = Y(t.vp)
          const exitColor = isShort ? '#1b7a4b' : '#c0392b'
          const exitGlyph = isShort
            ? <path d={`M${xs} ${ys + 16} l-6 11 l12 0 z`} fill={exitColor} />
            : <path d={`M${xs} ${ys - 16} l-6 -11 l12 0 z`} fill={exitColor} />
          const exitLabel = (
            <text x={xs} y={isShort ? ys + 41 : ys - 32} textAnchor="middle" fontSize="9"
              fontFamily="var(--font, sans-serif)" fill={exitColor}>
              {shortDate(candles[t.vi]?.f)}
            </text>
          )
          const exitMarker = (
            <g
              key={`mX-${k}`}
              style={{ cursor: 'help' }}
              onMouseEnter={e => handleEnter(e, t)}
              onMouseLeave={handleLeave}
            >
              <circle cx={xs} cy={isShort ? ys + 20 : ys - 24} r="14" fill="transparent" />
              {exitGlyph}
              {exitLabel}
            </g>
          )
          return <g key={`m-${k}`}>{entryMarker}{exitMarker}</g>
        })}

        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b}
          stroke="#e5e5e5" strokeWidth="1" />
        {ticks.map(i => (
          <g key={`tk-${i}`}>
            <line x1={X(i)} y1={H - PAD.b} x2={X(i)} y2={H - PAD.b + 4}
              stroke="#9aa0a6" strokeWidth="1" />
            <text x={X(i)} y={axisY + 12} textAnchor="middle" fontSize="11"
              fontFamily="var(--font, sans-serif)" fill="#6b6b6b">
              {shortDate(candles[i]?.f)}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(hovered.x + 12, (wrapperRef.current?.clientWidth ?? 0) - 260),
            top: Math.max(8, hovered.y - 110),
          }}
        >
          <TradeTooltip trade={hovered.trade} symbol={symbol} />
        </div>
      )}
    </div>
  )
}

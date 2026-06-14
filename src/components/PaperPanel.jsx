import { equity, floatingPnL } from '../lib/paperTrader.js'
import { price, usdPrecise, signed, pct, qty as fmtQty } from '../lib/format.js'
import InfoTip from './InfoTip.jsx'

function shortTimestamp(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
}

function ageSeconds(ts) {
  if (!ts) return null
  return Math.max(0, Math.round((Date.now() - ts) / 1000))
}

function ageLabel(seconds) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  return `${Math.round(seconds / 3600)}h ago`
}

function reasonTag(reason) {
  if (reason === 'SL') return <span className="tag tag-sl">SL</span>
  if (reason === 'TP') return <span className="tag tag-tp">TP</span>
  return null
}

function sideTag(side) {
  if (side === 'short' || side === -1) return <span className="tag tag-short">SHORT</span>
  return <span className="tag tag-long">LONG</span>
}

export default function PaperPanel({
  enabled, state, currentPrice, symbol, coinLabel, intervalLabel, stratLabel, dirLabel,
  onToggle, onReset,
}) {
  const op = state?.openPosition
  const eq = state ? equity(state, currentPrice) : 0
  const startBal = state?.startBalance ?? 0
  const totalPnL = eq - startBal
  const totalPct = startBal > 0 ? (totalPnL / startBal) * 100 : 0
  const floatPnL = op && currentPrice ? floatingPnL(op, currentPrice) : 0
  const lastTickAge = ageSeconds(state?.lastTickAt)

  return (
    <section className="paperblock">
      <div className="paper-head">
        <div>
          <div className="label">Live paper trading <InfoTip>Runs your current strategy forward in time against live prices, with virtual money. Persists in your browser — no account, no real money. Closes when the strategy signals or when SL/TP is hit on live candles.</InfoTip></div>
          <div className="paper-tracking">
            Tracking: <b>{coinLabel}</b> · {intervalLabel} · {stratLabel} · {dirLabel}
          </div>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
          <span>{enabled ? 'running' : 'off'}</span>
        </label>
      </div>

      {!state && (
        <div className="paper-empty">
          Enable the toggle above to start a live paper session. Polls live prices every 30 seconds
          and executes virtual trades based on the strategy you have configured.
        </div>
      )}

      {state && (
        <>
          <div className="paper-stats">
            <div className="pstat">
              <div className="label">Started</div>
              <div className="num">{shortTimestamp(state.startedAt)}</div>
              <div className="sub">with {usdPrecise(state.startBalance)}</div>
            </div>
            <div className="pstat">
              <div className="label">Current equity</div>
              <div className={`num num-md ${totalPnL >= 0 ? 'pos' : 'neg'}`}>{usdPrecise(eq)}</div>
              <div className="sub">
                <span className={totalPnL >= 0 ? 'pos' : 'neg'}>
                  {signed(totalPnL)} ({pct(totalPct)})
                </span>
              </div>
            </div>
            <div className="pstat">
              <div className="label">Cash · in market</div>
              <div className="num">
                {usdPrecise(state.cash)}{' '}
                <span style={{ color: 'var(--mute)' }}>·</span>{' '}
                {usdPrecise(Math.max(0, eq - state.cash))}
              </div>
              <div className="sub">
                {enabled
                  ? `polling every 30s · last: ${ageLabel(lastTickAge)}`
                  : 'paused'}
              </div>
            </div>
          </div>

          {op && (
            <div className="paper-open">
              <div className="label">Open position</div>
              <div className="paper-open-row">
                <div>
                  {sideTag(op.side)} {fmtQty(op.qty, symbol)} · entry {price(op.entryPrice)}{' '}
                  <span style={{ color: 'var(--mute)' }}>· {shortTimestamp(op.entryTime)}</span>
                </div>
                <div>
                  Live: {currentPrice ? price(currentPrice) : '—'}{' '}
                  <span className={floatPnL >= 0 ? 'pos' : 'neg'}>
                    ({signed(floatPnL)})
                  </span>
                </div>
              </div>
              <div className="paper-open-sl">
                SL: {op.slPrice ? price(op.slPrice) : 'off'} ·
                {' '}TP: {op.tpPrice ? price(op.tpPrice) : 'off'} ·
                {' '}invested {usdPrecise(op.invested)}
              </div>
            </div>
          )}

          <div className="paper-history">
            <div className="label" style={{ marginBottom: 'var(--s2)' }}>
              Closed trades ({state.closedTrades.length})
            </div>
            {state.closedTrades.length === 0 ? (
              <div style={{ color: 'var(--mute)', fontSize: 13, padding: 'var(--s2) 0' }}>
                No closed trades yet.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Side</th><th>Bought</th><th>Sold</th>
                    <th className="r">Result (net)</th><th className="r">P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.closedTrades].reverse().map((t, i) => {
                    const idx = state.closedTrades.length - i
                    const cls = t.netPct >= 0 ? 'pos' : 'neg'
                    return (
                      <tr key={idx}>
                        <td className="num">{idx}</td>
                        <td>{sideTag(t.side)}</td>
                        <td className="num">
                          {shortTimestamp(t.entryTime)} · {price(t.entryPrice)}
                        </td>
                        <td className="num">
                          {shortTimestamp(t.exitTime)} · {price(t.exitPrice)} {reasonTag(t.reason)}
                        </td>
                        <td className={`r num ${cls}`}>{pct(t.netPct)}</td>
                        <td className={`r num ${cls}`}>{signed(t.pnlUSD)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <button type="button" className="btn-ghost paper-reset" onClick={onReset}>
            Reset paper trading
          </button>
        </>
      )}
    </section>
  )
}

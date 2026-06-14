import { equity, floatingPnL } from '../lib/paperTrader.js'
import { price, usdPrecise, signed, pct, qty as fmtQty } from '../lib/format.js'
import { coinByPair } from '../lib/coins.js'
import { STRATS } from '../lib/strategies.js'
import PriceChart from './PriceChart.jsx'

const CHART_VISIBLE = 150

function timestamp(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
}

function ageLabel(ts) {
  if (!ts) return '—'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
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

function findIdx(candles, time) {
  if (!time) return -1
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].t <= time) return i
  }
  return -1
}

function buildChartData(bot) {
  const candles = bot.state.candles
  if (!candles || candles.length < 2) return null

  const recent = candles.slice(-CHART_VISIBLE)
  const offset = candles.length - recent.length

  let lines = { a: [], b: [] }
  try {
    const Slive = STRATS[bot.config.stratKey]
    const dir = Slive.supportsDirection ? bot.config.direction : 'long'
    const full = Slive.run(candles, bot.config.params, dir)
    lines = {
      a: full.lines.a.slice(offset),
      b: full.lines.b.slice(offset),
    }
  } catch {}

  const trades = []
  for (const t of bot.state.closedTrades) {
    const ciFull = findIdx(candles, t.entryTime)
    const viFull = findIdx(candles, t.exitTime)
    const ci = ciFull - offset
    const vi = viFull - offset
    if (ci < 0 && vi < 0) continue
    trades.push({
      ci: Math.max(ci, 0),
      cf: recent[Math.max(ci, 0)]?.f || '',
      cp: t.entryPrice,
      vi: vi >= 0 ? vi : (viFull >= 0 ? recent.length - 1 : null),
      vf: vi >= 0 ? recent[vi]?.f || '' : null,
      vp: t.exitPrice,
      side: t.side,
      reason: t.reason,
      qty: t.qty,
      investedUSD: t.invested,
      pnlUSD: t.pnlUSD,
      retNet: t.netPct,
    })
  }
  if (bot.state.openPosition) {
    const op = bot.state.openPosition
    const ciFull = findIdx(candles, op.entryTime)
    const ci = ciFull - offset
    if (ci >= 0) {
      trades.push({
        ci,
        cf: recent[ci]?.f || '',
        cp: op.entryPrice,
        vi: null,
        vf: null,
        vp: bot.state.lastPrice ?? op.entryPrice,
        side: op.side === 1 ? 'long' : 'short',
        reason: 'open',
        qty: op.qty,
        investedUSD: op.invested,
        pnlUSD: null,
        retNet: null,
      })
    }
  }

  return { recent, lines, trades }
}

function ClosedTradesTable({ trades, symbol }) {
  if (!trades.length) return null
  const rows = [...trades].reverse()
  return (
    <div className="bot-trades">
      <div className="label" style={{ marginBottom: 'var(--s2)' }}>
        Closed trades ({trades.length})
      </div>
      <div className="bot-trades-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Side</th>
              <th>Bought</th>
              <th>Sold</th>
              <th className="r">Result (net)</th>
              <th className="r">Fees</th>
              <th className="r">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const idx = trades.length - i
              const cls = t.netPct >= 0 ? 'pos' : 'neg'
              return (
                <tr key={`${t.exitTime}-${t.entryTime}`}>
                  <td className="num">{idx}</td>
                  <td>{sideTag(t.side)}</td>
                  <td className="num">
                    {timestamp(t.entryTime)} · {price(t.entryPrice)}
                    <div style={{ color: 'var(--mute)', fontSize: 11 }}>
                      {fmtQty(t.qty, symbol)} for {usdPrecise(t.invested)}
                    </div>
                  </td>
                  <td className="num">
                    {timestamp(t.exitTime)} · {price(t.exitPrice)} {reasonTag(t.reason)}
                  </td>
                  <td className={`r num ${cls}`}>{pct(t.netPct)}</td>
                  <td className="r num" style={{ color: 'var(--mute)' }}>
                    {usdPrecise(t.feeUSD ?? 0)}
                  </td>
                  <td className={`r num ${cls}`}>
                    {signed(t.pnlUSD)}
                    <div style={{ color: 'var(--mute)', fontSize: 11, fontWeight: 400 }}>
                      → {usdPrecise(t.invested + t.pnlUSD)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BotCard({ bot, onToggle, onDelete }) {
  const { config, state } = bot
  const coin = coinByPair(config.pair)
  const S = STRATS[config.stratKey]
  const op = state.openPosition
  const eq = equity(state, state.lastPrice)
  const pnl = eq - state.startBalance
  const pnlPct = state.startBalance > 0 ? (pnl / state.startBalance) * 100 : 0
  const cls = pnl >= 0 ? 'pos' : 'neg'
  const chart = buildChartData(bot)
  const [l1, l2] = S.leyenda(config.params)

  return (
    <div className="bot-card">
      <div className="bot-head">
        <div>
          <div className="bot-name">
            {bot.name} <span className="tag tag-testnet">LIVE TESTNET</span>
          </div>
          <div className="bot-meta">
            {coin.symbol} · {config.interval} · {S.nombre} · {config.effectiveDirection}
            {config.stopPct > 0 && ` · SL ${config.stopPct}%`}
            {config.takePct > 0 && ` · TP ${config.takePct}%`}
            {' · '}{config.compound ? 'compounding' : 'fixed size'}
          </div>
          {state.lastError && (
            <div style={{ color: 'var(--neg)', fontSize: 12, marginTop: 4 }}>
              ⚠ Last tick error: {state.lastError}
            </div>
          )}
        </div>
        <div className="bot-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onToggle(bot.id)}
            title={bot.running ? 'Pause polling' : 'Resume polling'}
          >
            {bot.running ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            className="btn-ghost btn-danger"
            onClick={() => {
              if (confirm(`Delete bot "${bot.name}"? Closed trades will be lost.`)) onDelete(bot.id)
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="bot-stats">
        <div className="bstat">
          <div className="label">Equity</div>
          <div className={`num ${cls}`}>{usdPrecise(eq)}</div>
          <div className="sub">
            <span className={cls}>{signed(pnl)} ({pct(pnlPct)})</span>
          </div>
        </div>
        <div className="bstat">
          <div className="label">Started</div>
          <div className="num">{timestamp(state.startedAt)}</div>
          <div className="sub">with {usdPrecise(state.startBalance)}</div>
        </div>
        <div className="bstat">
          <div className="label">Closed · Open</div>
          <div className="num">
            {state.closedTrades.length} · {op ? 1 : 0}
          </div>
          <div className="sub">
            {bot.running
              ? `streaming · last ${ageLabel(state.lastTickAt)}`
              : 'paused'}
          </div>
        </div>
      </div>

      {op && (
        <div className="bot-open">
          <div className="label" style={{ marginBottom: 'var(--s2)' }}>Open position</div>
          {sideTag(op.side)} {fmtQty(op.qty, coin.symbol)} · entry {price(op.entryPrice)}{' '}
          <span style={{ color: 'var(--mute)' }}>· {timestamp(op.entryTime)}</span>
          {state.lastPrice && (() => {
            const fp = floatingPnL(op, state.lastPrice)
            const total = op.invested + fp
            return (
              <>
                {' '}· live {price(state.lastPrice)}{' '}
                <span className={fp >= 0 ? 'pos' : 'neg'}>
                  ({signed(fp)} → {usdPrecise(total)})
                </span>
              </>
            )
          })()}
          <div className="bot-open-sl">
            SL: {op.slPrice ? price(op.slPrice) : 'off'} ·
            {' '}TP: {op.tpPrice ? price(op.tpPrice) : 'off'} ·
            {' '}invested {usdPrecise(op.invested)}
          </div>
        </div>
      )}

      <div className="bot-chart">
        <div className="bot-chart-head">
          <div className="label">Live · last {chart ? chart.recent.length : 0} candles</div>
          <div className="legend">
            <span><span className="sw" style={{ background: 'var(--accent)' }}></span>{l1}</span>
            <span><span className="sw" style={{ background: '#9aa0a6' }}></span>{l2}</span>
            <span><span className="tri-up"></span>Buy</span>
            <span><span className="tri-dn"></span>Sell</span>
          </div>
        </div>
        {chart ? (
          <PriceChart
            candles={chart.recent}
            lines={chart.lines}
            trades={chart.trades}
            height={220}
            symbol={coin.symbol}
          />
        ) : (
          <div className="bot-chart-empty">
            Waiting for first live candles… (poll every 30s)
          </div>
        )}
      </div>

      <ClosedTradesTable trades={state.closedTrades} symbol={coin.symbol} />
    </div>
  )
}

function TotalsCard({ bots }) {
  const totals = bots.reduce((acc, bot) => {
    for (const t of bot.state.closedTrades) {
      acc.invested += t.invested
      acc.fees += t.feeUSD || 0
      acc.pnl += t.pnlUSD
      acc.trades += 1
      if (t.pnlUSD > 0) acc.wins += 1
    }
    if (bot.state.openPosition) {
      acc.openInvested += bot.state.openPosition.invested
      acc.openCount += 1
      if (bot.state.lastPrice) {
        acc.openFloating += floatingPnL(bot.state.openPosition, bot.state.lastPrice)
      }
    }
    acc.startBalance += bot.state.startBalance
    return acc
  }, {
    invested: 0, fees: 0, pnl: 0, trades: 0, wins: 0,
    openInvested: 0, openCount: 0, openFloating: 0,
    startBalance: 0,
  })

  const losses = totals.trades - totals.wins
  const winRate = totals.trades > 0 ? (totals.wins / totals.trades) * 100 : 0
  const realizedReturnPct = totals.startBalance > 0
    ? (totals.pnl / totals.startBalance) * 100
    : 0
  const netCls = totals.pnl >= 0 ? 'pos' : 'neg'
  const floatCls = totals.openFloating >= 0 ? 'pos' : 'neg'

  return (
    <div className="totals-card">
      <div className="label" style={{ marginBottom: 'var(--s3)' }}>
        Totals across all bots ({bots.length})
      </div>
      <table className="totals-table">
        <tbody>
          <tr>
            <td>Starting capital</td>
            <td className="r num">{usdPrecise(totals.startBalance)}</td>
          </tr>
          <tr>
            <td>Closed trades</td>
            <td className="r num">
              {totals.trades}
              <span style={{ color: 'var(--mute)', fontSize: 11, marginLeft: 8 }}>
                {totals.wins}W / {losses}L ({winRate.toFixed(0)}% win rate)
              </span>
            </td>
          </tr>
          <tr>
            <td>Total invested (sum of every trade)</td>
            <td className="r num">{usdPrecise(totals.invested)}</td>
          </tr>
          <tr>
            <td>Total fees</td>
            <td className="r num" style={{ color: 'var(--mute)' }}>
              {usdPrecise(totals.fees)}
            </td>
          </tr>
          <tr>
            <td><b>Realized P&amp;L</b></td>
            <td className={`r num ${netCls}`}>
              <b>{signed(totals.pnl)}</b>
              <span style={{ marginLeft: 8 }}>({pct(realizedReturnPct)})</span>
            </td>
          </tr>
          {totals.openCount > 0 && (
            <tr>
              <td>Open positions · floating P&amp;L</td>
              <td className={`r num ${floatCls}`}>
                {totals.openCount} open · {signed(totals.openFloating)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function TradesView({ bots, onToggleBot, onDeleteBot }) {
  return (
    <div className="trades-view">
      <div className="trades-head">
        <div>
          <div className="label">Active bots</div>
          <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 4 }}>
            {bots.length === 0
              ? 'No bots yet. Configure a strategy in the Backtest tab and click "Create live Testnet bot".'
              : `${bots.length} ${bots.length === 1 ? 'bot' : 'bots'} · streaming live from Binance Testnet`}
          </div>
        </div>
      </div>

      {bots.length > 0 && (
        <div className="bot-list">
          {bots.map(b => (
            <BotCard
              key={b.id}
              bot={b}
              onToggle={onToggleBot}
              onDelete={onDeleteBot}
            />
          ))}
        </div>
      )}

      {bots.length > 0 && <TotalsCard bots={bots} />}
    </div>
  )
}

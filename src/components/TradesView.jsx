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


// Find the latest candle index whose timestamp is <= time.
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
            {bot.name}{' '}
            {config.executor === 'binance-testnet'
              ? <span className="tag tag-testnet">LIVE TESTNET</span>
              : <span className="tag tag-open">PAPER</span>}
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
    </div>
  )
}

export default function TradesView({ bots, onToggleBot, onDeleteBot, onCreateBot, currentConfigLabel }) {
  const openRows = bots
    .filter(b => b.state.openPosition)
    .map(b => ({
      bot: b,
      pos: b.state.openPosition,
      live: b.state.lastPrice,
      coin: coinByPair(b.config.pair),
    }))

  const closedRows = bots.flatMap(b =>
    b.state.closedTrades.map((t, i) => ({
      ...t,
      botName: b.name,
      botId: b.id,
      symbol: coinByPair(b.config.pair).symbol,
      tradeIdx: i + 1,
    }))
  ).sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0))

  return (
    <div className="trades-view">
      <div className="trades-head">
        <div>
          <div className="label">Active bots</div>
          <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 4 }}>
            {bots.length === 0
              ? 'No bots yet. Configure a strategy in the Backtest tab, then come back and create one.'
              : `${bots.length} ${bots.length === 1 ? 'bot' : 'bots'} · polling every 30s while running`}
          </div>
        </div>
        <button type="button" className="btn" onClick={onCreateBot}>
          + Create bot from current config
        </button>
      </div>
      {currentConfigLabel && bots.length === 0 && (
        <div className="trades-hint">
          Current Backtest config will be saved as: <b>{currentConfigLabel}</b>
        </div>
      )}

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

      {bots.length > 0 && (
        <div className="cross-block">
          <div className="label" style={{ marginBottom: 'var(--s2)' }}>
            Open positions ({openRows.length})
          </div>
          {openRows.length === 0 ? (
            <div className="empty-row">No open positions across any bot.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Side</th>
                  <th>Bought</th>
                  <th>Live</th>
                  <th className="r">Floating P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {openRows.map(({ bot, pos, live, coin }) => {
                  const fp = live ? floatingPnL(pos, live) : 0
                  return (
                    <tr key={bot.id}>
                      <td>
                        {bot.name}
                        <div style={{ color: 'var(--mute)', fontSize: 11, marginTop: 2 }}>
                          {coin.symbol}
                        </div>
                      </td>
                      <td>{sideTag(pos.side)}</td>
                      <td className="num">
                        {timestamp(pos.entryTime)} · {price(pos.entryPrice)}
                        <div style={{ color: 'var(--mute)', fontSize: 12 }}>
                          {fmtQty(pos.qty, coin.symbol)} for {usdPrecise(pos.invested)}
                        </div>
                      </td>
                      <td className="num">
                        {live ? price(live) : '—'}
                      </td>
                      <td className={`r num ${fp >= 0 ? 'pos' : 'neg'}`}>
                        {signed(fp)}
                        <div style={{ color: 'var(--mute)', fontSize: 11, fontWeight: 400 }}>
                          → {usdPrecise(pos.invested + fp)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {bots.length > 0 && (
        <div className="cross-block">
          <div className="label" style={{ marginBottom: 'var(--s2)' }}>
            Closed trades ({closedRows.length})
          </div>
          {closedRows.length === 0 ? (
            <div className="empty-row">No closed trades yet across any bot.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Side</th>
                  <th>Bought</th>
                  <th>Sold</th>
                  <th className="r">Result (net)</th>
                  <th className="r">Fees</th>
                  <th className="r">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {closedRows.map(t => {
                  const cls = t.netPct >= 0 ? 'pos' : 'neg'
                  return (
                    <tr key={`${t.botId}-${t.exitTime}-${t.entryTime}`}>
                      <td>
                        {t.botName}
                        <div style={{ color: 'var(--mute)', fontSize: 11, marginTop: 2 }}>
                          {t.symbol}
                        </div>
                      </td>
                      <td>{sideTag(t.side)}</td>
                      <td className="num">
                        {timestamp(t.entryTime)} · {price(t.entryPrice)}
                        <div style={{ color: 'var(--mute)', fontSize: 12 }}>
                          {fmtQty(t.qty, t.symbol)} for {usdPrecise(t.invested)}
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
          )}
        </div>
      )}
    </div>
  )
}

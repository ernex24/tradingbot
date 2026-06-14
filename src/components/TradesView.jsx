import { equity, floatingPnL } from '../lib/paperTrader.js'
import { price, usdPrecise, signed, pct, qty as fmtQty } from '../lib/format.js'
import { SOURCE_LABELS, coinByPair } from '../lib/coins.js'
import { STRATS } from '../lib/strategies.js'

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

function BotCard({ bot, onToggle, onDelete }) {
  const { config, state } = bot
  const coin = coinByPair(config.pair)
  const S = STRATS[config.stratKey]
  const op = state.openPosition
  const eq = equity(state, state.lastPrice)
  const pnl = eq - state.startBalance
  const pnlPct = state.startBalance > 0 ? (pnl / state.startBalance) * 100 : 0
  const cls = pnl >= 0 ? 'pos' : 'neg'

  return (
    <div className="bot-card">
      <div className="bot-head">
        <div>
          <div className="bot-name">{bot.name}</div>
          <div className="bot-meta">
            {coin.symbol} · {SOURCE_LABELS[config.source]} · {config.interval} ·{' '}
            {S.nombre} · {config.effectiveDirection}
            {config.stopPct > 0 && ` · SL ${config.stopPct}%`}
            {config.takePct > 0 && ` · TP ${config.takePct}%`}
            {' · '}{config.compound ? 'compounding' : 'fixed size'}
          </div>
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
              ? `polling · last ${ageLabel(state.lastTickAt)}`
              : 'paused'}
          </div>
        </div>
      </div>

      {op && (
        <div className="bot-open">
          {sideTag(op.side)} {fmtQty(op.qty, coin.symbol)} · entry {price(op.entryPrice)}{' '}
          <span style={{ color: 'var(--mute)' }}>· {timestamp(op.entryTime)}</span>
          {state.lastPrice && (
            <>
              {' '}· live {price(state.lastPrice)}{' '}
              <span className={floatingPnL(op, state.lastPrice) >= 0 ? 'pos' : 'neg'}>
                ({signed(floatingPnL(op, state.lastPrice))})
              </span>
            </>
          )}
          <div className="bot-open-sl">
            SL: {op.slPrice ? price(op.slPrice) : 'off'} ·
            {' '}TP: {op.tpPrice ? price(op.tpPrice) : 'off'} ·
            {' '}invested {usdPrecise(op.invested)}
          </div>
        </div>
      )}
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
                      <td>{bot.name}</td>
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
                  <th className="r">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {closedRows.map(t => {
                  const cls = t.netPct >= 0 ? 'pos' : 'neg'
                  return (
                    <tr key={`${t.botId}-${t.exitTime}-${t.entryTime}`}>
                      <td>{t.botName}</td>
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
                      <td className={`r num ${cls}`}>{signed(t.pnlUSD)}</td>
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

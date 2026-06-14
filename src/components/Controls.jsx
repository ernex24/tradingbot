import { STRATS } from '../lib/strategies.js'
import { COINS, SOURCE_LABELS, coinByPair } from '../lib/coins.js'
import InfoTip from './InfoTip.jsx'

const TIMEFRAMES = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
]

const DIRECTIONS = [
  { value: 'long', label: 'Long only' },
  { value: 'short', label: 'Short only' },
  { value: 'both', label: 'Both (always in market)' },
]

const PARAM_TIPS = {
  corta: 'Length of the fast moving average, in candles. Reacts quickly to price changes.',
  larga: 'Length of the slow moving average. A signal fires when the fast crosses the slow.',
  periodo: 'How many candles RSI looks back. 14 is the classic value.',
  compra: 'Enter long when RSI drops below this level — meaning the asset looks oversold.',
  venta: 'Exit (or enter short) when RSI rises above this level — meaning it looks overbought.',
  lookback: 'How many past candles define the breakout. A close above the highest high in this window = entry.',
}

export default function Controls({
  stratKey, params, onStratChange, onParamChange,
  pair, onPairChange,
  source, onSourceChange,
  interval, onIntervalChange,
  desde, hasta, minDate, maxDate, onDateChange,
  stopPct, takePct, onStopChange, onTakeChange,
  stake, compound, onStakeChange, onCompoundChange,
  direction, directionSupported, onDirectionChange,
  loading,
}) {
  const S = STRATS[stratKey]
  const coin = coinByPair(pair)
  const availableSources = coin.sources

  return (
    <section className="controls">
      <div className="ctl-group">
        <div className="group-label">Market</div>
        <div className="ctl-row">
          <div className="ctl">
            <label htmlFor="coin">
              Coin <InfoTip>Which cryptocurrency to backtest. Each has different volatility, liquidity and history.</InfoTip>
            </label>
            <select
              id="coin"
              value={pair}
              onChange={e => onPairChange(e.target.value)}
              disabled={loading}
            >
              {COINS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="ctl">
            <label htmlFor="src">
              Data source <InfoTip>Which exchange's prices to use. Binance has more history and tighter spreads. Kraken matches what you'd actually trade if your account is there. Hyperliquid is the only source for HYPE.</InfoTip>
            </label>
            <select
              id="src"
              value={source}
              onChange={e => onSourceChange(e.target.value)}
              disabled={loading || availableSources.length < 2}
              title={availableSources.length < 2 ? 'Only one exchange available for this coin.' : ''}
            >
              {availableSources.map(s => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div className="ctl">
            <label htmlFor="tf">
              Timeframe <InfoTip>How much time each candle represents. Shorter timeframes = more trades and more noise. Longer = fewer, cleaner signals.</InfoTip>
            </label>
            <select
              id="tf"
              value={interval}
              onChange={e => onIntervalChange(e.target.value)}
              disabled={loading}
            >
              {TIMEFRAMES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="ctl">
            <label htmlFor="from">
              From <InfoTip>Start date for the backtest. Candles before this date are excluded.</InfoTip>
            </label>
            <input
              id="from"
              type="date"
              value={desde}
              min={minDate}
              max={maxDate}
              onChange={e => onDateChange('desde', e.target.value)}
            />
          </div>

          <div className="ctl">
            <label htmlFor="to">
              To <InfoTip>End date for the backtest. Candles after this date are excluded.</InfoTip>
            </label>
            <input
              id="to"
              type="date"
              value={hasta}
              min={minDate}
              max={maxDate}
              onChange={e => onDateChange('hasta', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ctl-group">
        <div className="group-label">Strategy</div>
        <div className="ctl-row">
          <div className="ctl">
            <label htmlFor="strat">
              Strategy <InfoTip>The rule the bot uses to decide when to enter and exit trades. Different rules suit different markets.</InfoTip>
            </label>
            <select
              id="strat"
              value={stratKey}
              onChange={e => onStratChange(e.target.value)}
            >
              {Object.entries(STRATS).map(([k, s]) => (
                <option key={k} value={k}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div className="ctl">
            <label htmlFor="dir">
              Direction <InfoTip>Long profits when price rises. Short profits when price falls. Both alternates between them — always in the market.</InfoTip>
            </label>
            <select
              id="dir"
              value={direction}
              onChange={e => onDirectionChange(e.target.value)}
              disabled={!directionSupported}
              title={directionSupported ? '' : 'This strategy is long-only.'}
            >
              {DIRECTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {S.params.map(p => (
            <div className="ctl" key={p.k}>
              <label htmlFor={`p-${p.k}`}>
                {p.label} {PARAM_TIPS[p.k] && <InfoTip>{PARAM_TIPS[p.k]}</InfoTip>}
              </label>
              <input
                id={`p-${p.k}`}
                type="number"
                value={params[p.k] ?? p.def}
                min={p.min}
                max={p.max}
                onChange={e => {
                  const raw = +e.target.value
                  const v = Math.max(p.min, Math.min(p.max, raw))
                  onParamChange(p.k, Number.isFinite(v) ? v : p.def)
                }}
                style={{ width: 84 }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="ctl-group">
        <div className="group-label">Money & risk</div>
        <div className="ctl-row">
          <div className="ctl">
            <label htmlFor="amount">
              Amount ($) <InfoTip>Starting capital in dollars. The bot simulates as if you began with this much in your account.</InfoTip>
            </label>
            <input
              id="amount"
              type="number"
              value={stake}
              min={1}
              max={10000000}
              step="1"
              onChange={e => {
                const v = +e.target.value
                onStakeChange(Math.max(1, Number.isFinite(v) ? v : 1000))
              }}
              style={{ width: 120 }}
            />
          </div>

          <div className="ctl">
            <label htmlFor="reinvest">
              Reinvest profits <InfoTip>On (compounding): each trade reinvests previous gains or losses — positions grow when winning, shrink when losing. Off (fixed size): every trade uses the exact same amount, no matter the past results.</InfoTip>
            </label>
            <label className="toggle" htmlFor="reinvest">
              <input
                id="reinvest"
                type="checkbox"
                checked={compound}
                onChange={e => onCompoundChange(e.target.checked)}
              />
              <span>{compound ? 'compounding' : 'fixed size'}</span>
            </label>
          </div>

          <div className="ctl">
            <label htmlFor="sl">
              Stop loss % <InfoTip>Forces an exit if price moves AGAINST you by this percent from entry. Caps how much each trade can lose. 0 = disabled.</InfoTip>
            </label>
            <input
              id="sl"
              type="number"
              value={stopPct}
              min={0}
              max={50}
              step="0.1"
              onChange={e => {
                const v = +e.target.value
                onStopChange(Math.max(0, Math.min(50, Number.isFinite(v) ? v : 0)))
              }}
              style={{ width: 84 }}
            />
          </div>

          <div className="ctl">
            <label htmlFor="tp">
              Take profit % <InfoTip>Forces an exit if price moves IN YOUR FAVOR by this percent from entry. Locks in a gain. 0 = disabled (let the strategy decide).</InfoTip>
            </label>
            <input
              id="tp"
              type="number"
              value={takePct}
              min={0}
              max={500}
              step="0.1"
              onChange={e => {
                const v = +e.target.value
                onTakeChange(Math.max(0, Math.min(500, Number.isFinite(v) ? v : 0)))
              }}
              style={{ width: 84 }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

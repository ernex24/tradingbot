import { STRATS } from '../lib/strategies.js'
import { COINS } from '../lib/coins.js'

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

export default function Controls({
  stratKey, params, onStratChange, onParamChange,
  pair, onPairChange,
  interval, onIntervalChange,
  desde, hasta, minDate, maxDate, onDateChange,
  stopPct, takePct, onStopChange, onTakeChange,
  stake, compound, onStakeChange, onCompoundChange,
  direction, directionSupported, onDirectionChange,
  loading,
}) {
  const S = STRATS[stratKey]

  return (
    <section className="controls">
      <div className="ctl-group">
        <div className="group-label">Market</div>
        <div className="ctl-row">
          <div className="ctl">
            <label htmlFor="coin">Coin</label>
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
            <label htmlFor="tf">Timeframe</label>
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
            <label htmlFor="from">From</label>
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
            <label htmlFor="to">To</label>
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
            <label htmlFor="strat">Strategy</label>
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
            <label htmlFor="dir">Direction</label>
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
              <label htmlFor={`p-${p.k}`}>{p.label}</label>
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
            <label htmlFor="amount">Amount ($)</label>
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
            <label htmlFor="reinvest">Reinvest profits</label>
            <label className="toggle" htmlFor="reinvest" title="On: compound profits into next trade. Off: each trade uses the same fixed amount.">
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
            <label htmlFor="sl">Stop loss %</label>
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
            <label htmlFor="tp">Take profit %</label>
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

import { STRATS } from '../lib/strategies.js'

const TIMEFRAMES = [
  { value: '60', label: '1 hour' },
  { value: '240', label: '4 hours' },
  { value: '1440', label: '1 day' },
]

export default function Controls({
  stratKey, params, onStratChange, onParamChange,
  interval, onIntervalChange,
  desde, hasta, minDate, maxDate, onDateChange, onResetRange,
  stopPct, takePct, onStopChange, onTakeChange,
  onReload, loading,
}) {
  const S = STRATS[stratKey]

  return (
    <section className="controls">
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
        <label>Parameters</label>
        <div className="params">
          {S.params.length === 0
            ? <span className="empty">— no parameters —</span>
            : S.params.map(p => (
              <div className="pfield" key={p.k}>
                <span>{p.label}</span>
                <input
                  type="number"
                  value={params[p.k] ?? p.def}
                  min={p.min}
                  max={p.max}
                  onChange={e => {
                    const raw = +e.target.value
                    const v = Math.max(p.min, Math.min(p.max, raw))
                    onParamChange(p.k, Number.isFinite(v) ? v : p.def)
                  }}
                />
              </div>
            ))}
        </div>
      </div>

      <div className="ctl">
        <label>Risk (% from entry, 0 = off)</label>
        <div className="params">
          <div className="pfield">
            <span>Stop loss</span>
            <input
              type="number"
              value={stopPct}
              min={0}
              max={50}
              step="0.1"
              onChange={e => {
                const v = +e.target.value
                onStopChange(Math.max(0, Math.min(50, Number.isFinite(v) ? v : 0)))
              }}
            />
          </div>
          <div className="pfield">
            <span>Take profit</span>
            <input
              type="number"
              value={takePct}
              min={0}
              max={500}
              step="0.1"
              onChange={e => {
                const v = +e.target.value
                onTakeChange(Math.max(0, Math.min(500, Number.isFinite(v) ? v : 0)))
              }}
            />
          </div>
        </div>
      </div>

      <div className="ctl">
        <label>Date range</label>
        <div className="params">
          <div className="pfield">
            <span>From</span>
            <input
              type="date"
              value={desde}
              min={minDate}
              max={maxDate}
              onChange={e => onDateChange('desde', e.target.value)}
            />
          </div>
          <div className="pfield">
            <span>To</span>
            <input
              type="date"
              value={hasta}
              min={minDate}
              max={maxDate}
              onChange={e => onDateChange('hasta', e.target.value)}
            />
          </div>
          <div className="pfield">
            <span>&nbsp;</span>
            <button
              type="button"
              className="btn-ghost"
              onClick={onResetRange}
              title="Use the entire available period"
            >
              All
            </button>
          </div>
        </div>
      </div>

      <div className="ctl">
        <label>&nbsp;</label>
        <button className="btn" onClick={onReload} disabled={loading}>
          {loading ? 'Loading…' : 'Load live data'}
        </button>
      </div>
    </section>
  )
}

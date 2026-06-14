import { STRATS } from '../lib/strategies.js'

export default function Controls({
  stratKey, params, onStratChange, onParamChange,
  onReload, loading,
}) {
  const S = STRATS[stratKey]

  return (
    <section className="controls">
      <div className="ctl">
        <label htmlFor="strat">Estrategia</label>
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
        <label>Parámetros</label>
        <div className="params">
          {S.params.length === 0
            ? <span className="empty">— sin parámetros —</span>
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
        <label>&nbsp;</label>
        <button className="btn" onClick={onReload} disabled={loading}>
          {loading ? 'Cargando…' : 'Cargar datos en vivo'}
        </button>
      </div>
    </section>
  )
}

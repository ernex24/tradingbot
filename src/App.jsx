import { useMemo, useState } from 'react'
import { DEMO_CANDLES } from './lib/demoData.js'
import { STRATS } from './lib/strategies.js'
import { backtest } from './lib/backtest.js'
import Controls from './components/Controls.jsx'
import KPIs from './components/KPIs.jsx'
import PriceChart from './components/PriceChart.jsx'
import EquityChart from './components/EquityChart.jsx'
import TradeTable from './components/TradeTable.jsx'

function defaultParams(stratKey) {
  const out = {}
  STRATS[stratKey].params.forEach(p => { out[p.k] = p.def })
  return out
}

export default function App() {
  const [candles, setCandles] = useState(DEMO_CANDLES)
  const [dataSrc, setDataSrc] = useState('datos de demostración')
  const [updatedAt, setUpdatedAt] = useState('')
  const [stratKey, setStratKey] = useState('ma')
  const [params, setParams] = useState(() => defaultParams('ma'))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const S = STRATS[stratKey]
  const paramError = S.validar ? S.validar(params) : null

  const result = useMemo(() => {
    if (paramError) return null
    const { pos, lines } = S.run(candles, params)
    return { ...backtest(candles, pos), lines }
  }, [candles, stratKey, params, paramError, S])

  const handleStratChange = key => {
    setStratKey(key)
    setParams(defaultParams(key))
  }
  const handleParamChange = (k, v) => {
    setParams(prev => ({ ...prev, [k]: v }))
  }

  const cargarKraken = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const r = await fetch('/api/kraken?pair=XBTUSD&interval=1440')
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const data = await r.json()
      if (data.error && data.error.length) {
        throw new Error(data.error.join(', '))
      }
      const key = Object.keys(data.result).find(k => k !== 'last')
      const rows = data.result[key]
      const next = rows.map(row => ({
        f: new Date(row[0] * 1000).toISOString().slice(0, 10),
        o: Math.round(+row[1]),
        h: Math.round(+row[2]),
        l: Math.round(+row[3]),
        c: Math.round(+row[4]),
      }))
      setCandles(next)
      setDataSrc('datos en vivo · Kraken')
      setUpdatedAt('Act. ' + new Date().toLocaleString('es-ES'))
    } catch (e) {
      console.warn('Kraken fetch falló:', e)
      setLoadError('No se pudieron cargar datos en vivo (' + e.message + '). Usando demostración.')
      setDataSrc('Kraken no disponible — usando demostración')
    } finally {
      setLoading(false)
    }
  }

  const [l1, l2] = S.leyenda(params)
  const rango = candles.length
    ? `${candles[0].f} – ${candles[candles.length - 1].f}`
    : '—'

  return (
    <>
      <div className="safebar">
        <span className="dot"></span>
        Modo seguro · el bot no envía órdenes reales
        <span className="datasrc">{dataSrc}</span>
      </div>

      <div className="wrap">
        <header>
          <h1>Trend Bot <span>/ BTC/USD</span></h1>
          <div className="meta">
            <div>{rango}</div>
            <div>{updatedAt || '—'}</div>
          </div>
        </header>

        <Controls
          stratKey={stratKey}
          params={params}
          onStratChange={handleStratChange}
          onParamChange={handleParamChange}
          onReload={cargarKraken}
          loading={loading}
        />

        {paramError && <div className="warn">{paramError}</div>}
        {loadError && <div className="warn">{loadError}</div>}

        {result && <KPIs met={result.met} />}

        <section className="chartblock">
          <div className="chead">
            <div className="label">Velas, medias y operaciones</div>
            <div className="legend">
              <span><span className="sw" style={{ background: 'var(--accent)' }}></span>{l1}</span>
              <span><span className="sw" style={{ background: '#9aa0a6' }}></span>{l2}</span>
              <span><span className="tri-up"></span>Compra</span>
              <span><span className="tri-dn"></span>Venta</span>
            </div>
          </div>
          {result && (
            <PriceChart
              candles={candles}
              lines={result.lines}
              trades={result.trades}
            />
          )}
        </section>

        <section className="chartblock">
          <div className="chead">
            <div className="label">Tu dinero en el tiempo · $1,000 invertidos</div>
            <div className="legend">
              <span><span className="sw" style={{ background: 'var(--accent)' }}></span>Con la estrategia</span>
              <span><span className="sw" style={{ background: 'var(--mute)' }}></span>Si solo compras y aguantas</span>
            </div>
          </div>
          {result && <EquityChart eqArr={result.eqArr} bhArr={result.bhArr} />}
        </section>

        {result && <TradeTable trades={result.trades} />}

        <footer>
          Herramienta de investigación, no asesoramiento financiero. Las cifras de demostración
          no predicen rendimiento futuro. Orden correcto: backtest → paper trading → capital real y mínimo.
        </footer>
      </div>
    </>
  )
}

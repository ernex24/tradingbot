import { useEffect, useMemo, useState } from 'react'
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
  const [dataSrc, setDataSrc] = useState('demo data')
  const [updatedAt, setUpdatedAt] = useState('')
  const [stratKey, setStratKey] = useState('ma')
  const [params, setParams] = useState(() => defaultParams('ma'))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const minDate = candles[0]?.f ?? ''
  const maxDate = candles[candles.length - 1]?.f ?? ''
  const [desde, setDesde] = useState(minDate)
  const [hasta, setHasta] = useState(maxDate)

  // Reset range when candles change (data reload).
  useEffect(() => {
    setDesde(minDate)
    setHasta(maxDate)
  }, [minDate, maxDate])

  const visibleCandles = useMemo(() => {
    if (!desde && !hasta) return candles
    const lo = desde || minDate
    const hi = hasta || maxDate
    return candles.filter(c => c.f >= lo && c.f <= hi)
  }, [candles, desde, hasta, minDate, maxDate])

  const S = STRATS[stratKey]
  const paramError = S.validar ? S.validar(params) : null

  let rangeWarn = ''
  if (desde && hasta && desde > hasta) {
    rangeWarn = '"From" date is later than "To" date.'
  } else if (visibleCandles.length < 30) {
    rangeWarn = `Only ${visibleCandles.length} candles in range — need more data for a meaningful backtest.`
  }

  const result = useMemo(() => {
    if (paramError || rangeWarn) return null
    if (visibleCandles.length < 2) return null
    const { pos, lines } = S.run(visibleCandles, params)
    return { ...backtest(visibleCandles, pos), lines }
  }, [visibleCandles, stratKey, params, paramError, rangeWarn, S])

  const handleStratChange = key => {
    setStratKey(key)
    setParams(defaultParams(key))
  }
  const handleParamChange = (k, v) => {
    setParams(prev => ({ ...prev, [k]: v }))
  }
  const handleDateChange = (which, value) => {
    if (which === 'desde') setDesde(value || minDate)
    else setHasta(value || maxDate)
  }
  const resetRange = () => {
    setDesde(minDate)
    setHasta(maxDate)
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
      setDataSrc('live data · Kraken')
      setUpdatedAt('Updated ' + new Date().toLocaleString('en-US'))
    } catch (e) {
      console.warn('Kraken fetch failed:', e)
      setLoadError('Could not load live data (' + e.message + '). Using demo.')
      setDataSrc('Kraken unavailable — using demo')
    } finally {
      setLoading(false)
    }
  }

  const [l1, l2] = S.leyenda(params)
  const rango = visibleCandles.length
    ? `${visibleCandles[0].f} – ${visibleCandles[visibleCandles.length - 1].f}`
    : '—'

  return (
    <>
      <div className="safebar">
        <span className="dot"></span>
        Safe mode · the bot does not place real orders
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
          desde={desde}
          hasta={hasta}
          minDate={minDate}
          maxDate={maxDate}
          onDateChange={handleDateChange}
          onResetRange={resetRange}
          onReload={cargarKraken}
          loading={loading}
        />

        {paramError && <div className="warn">{paramError}</div>}
        {rangeWarn && <div className="warn">{rangeWarn}</div>}
        {loadError && <div className="warn">{loadError}</div>}

        {result && <KPIs met={result.met} />}

        <section className="chartblock">
          <div className="chead">
            <div className="label">Candles, moving averages and trades</div>
            <div className="legend">
              <span><span className="sw" style={{ background: 'var(--accent)' }}></span>{l1}</span>
              <span><span className="sw" style={{ background: '#9aa0a6' }}></span>{l2}</span>
              <span><span className="tri-up"></span>Buy</span>
              <span><span className="tri-dn"></span>Sell</span>
            </div>
          </div>
          {result && (
            <PriceChart
              candles={visibleCandles}
              lines={result.lines}
              trades={result.trades}
            />
          )}
        </section>

        <section className="chartblock">
          <div className="chead">
            <div className="label">Your money over time · $1,000 invested</div>
            <div className="legend">
              <span><span className="sw" style={{ background: 'var(--accent)' }}></span>With the strategy</span>
              <span><span className="sw" style={{ background: 'var(--mute)' }}></span>Buy and hold</span>
            </div>
          </div>
          {result && (
            <EquityChart
              eqArr={result.eqArr}
              bhArr={result.bhArr}
              candles={visibleCandles}
            />
          )}
        </section>

        {result && <TradeTable trades={result.trades} />}

        <footer>
          Research tool, not financial advice. Demo figures do not predict future performance.
          Correct order: backtest → paper trading → real capital, and start small.
        </footer>
      </div>
    </>
  )
}

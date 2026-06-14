import { STAKE } from '../lib/backtest.js'
import { usd, signed, pct } from '../lib/format.js'

export default function KPIs({ met }) {
  const finalVal = STAKE * (1 + met.total / 100)
  const ganancia = finalVal - STAKE

  return (
    <section className="kpis">
      <div className="kpi-main">
        <div className="label">Resultado con la estrategia</div>
        <div className={`big num ${met.total >= 0 ? 'pos' : 'neg'}`}>{pct(met.total)}</div>
        <div className="story">
          Invertiste <b>{usd(STAKE)}</b> → ahora tendrías <b>{usd(finalVal)}</b>{' '}
          <span className="num">({signed(ganancia)})</span>
        </div>
        <div className="story" style={{ fontSize: 14, marginTop: 6 }}>
          Solo comprar y aguantar habría dado {pct(met.bhTotal)}.
        </div>
      </div>

      <div className="kpi">
        <div className="label">Operaciones</div>
        <div className="num-md num">{met.n}</div>
        <div className="sub">
          <span className="pill win">{met.ganadores} ganadas</span>
          <span className="pill loss">{met.n - met.ganadores} perdidas</span>
        </div>
      </div>

      <div className="kpi">
        <div className="label">Mejor / peor operación</div>
        <div className="num-md num">
          <span style={{ color: 'var(--pos)' }}>{pct(met.mejor)}</span>{' '}
          <span style={{ color: 'var(--mute)', fontWeight: 400 }}>/</span>{' '}
          <span style={{ color: 'var(--neg)' }}>{pct(met.peor)}</span>
        </div>
        <div className="sub">
          En mercado {met.enMercado.toFixed(0)}% del tiempo · peor caída {met.maxdd.toFixed(0)}%
        </div>
      </div>
    </section>
  )
}

import { STAKE } from '../lib/backtest.js'
import { usd, signed, pct } from '../lib/format.js'

export default function TradeTable({ trades }) {
  if (!trades.length) {
    return (
      <section className="tradeblock">
        <div className="label" style={{ marginBottom: 'var(--s3)' }}>
          Cada operación: cuándo compré, cuándo vendí, cuánto gané o perdí
        </div>
        <table>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th><th>Compré</th><th>Vendí</th>
              <th className="r">Resultado (neto)</th>
              <th className="r">Sobre $1,000</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="5" style={{ color: 'var(--mute)' }}>
                Esta estrategia no hizo ninguna operación en el periodo.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    )
  }

  return (
    <section className="tradeblock">
      <div className="label" style={{ marginBottom: 'var(--s3)' }}>
        Cada operación: cuándo compré, cuándo vendí, cuánto gané o perdí
      </div>
      <table>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th><th>Compré</th><th>Vendí</th>
            <th className="r">Resultado (neto)</th>
            <th className="r">Sobre $1,000</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const cls = t.retNet >= 0 ? 'pos' : 'neg'
            const dollar = STAKE * t.retNet / 100
            return (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td className="num">{t.cf} · {usd(t.cp)}</td>
                <td className="num">
                  {t.vf
                    ? `${t.vf} · ${usd(t.vp)}`
                    : <span style={{ color: 'var(--mute)' }}>posición abierta · {usd(t.vp)}</span>}
                </td>
                <td className={`r res num ${cls}`}>{pct(t.retNet)}</td>
                <td className={`r res num ${cls}`}>{signed(dollar)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="tnote">
        Resultado neto = ya descontadas las comisiones de entrada y salida (0,16% cada lado).
        La columna "Sobre $1,000" muestra cuánto habrías ganado o perdido si pusieras $1,000
        en cada operación por separado (sin reinvertir).
      </div>
    </section>
  )
}

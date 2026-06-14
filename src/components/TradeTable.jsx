import { STAKE } from '../lib/backtest.js'
import { usd, signed, pct } from '../lib/format.js'

export default function TradeTable({ trades }) {
  if (!trades.length) {
    return (
      <section className="tradeblock">
        <div className="label" style={{ marginBottom: 'var(--s3)' }}>
          Every trade: when bought, when sold, profit or loss
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
              <th>#</th><th>Bought</th><th>Sold</th>
              <th className="r">Result (net)</th>
              <th className="r">On $1,000</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="5" style={{ color: 'var(--mute)' }}>
                This strategy made no trades in the period.
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
        Every trade: when bought, when sold, profit or loss
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
            <th>#</th><th>Bought</th><th>Sold</th>
            <th className="r">Result (net)</th>
            <th className="r">On $1,000</th>
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
                    : <span style={{ color: 'var(--mute)' }}>open position · {usd(t.vp)}</span>}
                </td>
                <td className={`r res num ${cls}`}>{pct(t.retNet)}</td>
                <td className={`r res num ${cls}`}>{signed(dollar)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="tnote">
        Net result = entry and exit commissions already subtracted (0.16% each side).
        The "On $1,000" column shows how much you would have made or lost if you put $1,000
        on each trade separately (no compounding).
      </div>
    </section>
  )
}

import { price, usdPrecise, signed, pct, qty as fmtQty } from '../lib/format.js'

function reasonTag(reason) {
  if (reason === 'SL') return <span className="tag tag-sl" title="Stop loss hit">SL</span>
  if (reason === 'TP') return <span className="tag tag-tp" title="Take profit hit">TP</span>
  if (reason === 'open') return <span className="tag tag-open" title="Still open at end of period">open</span>
  return null
}

function Header() {
  return (
    <thead>
      <tr>
        <th>#</th>
        <th>Bought</th>
        <th>Size</th>
        <th>Sold</th>
        <th className="r">Result (net)</th>
        <th className="r">P&amp;L</th>
      </tr>
    </thead>
  )
}

function Cols() {
  return (
    <colgroup>
      <col style={{ width: '4%' }} />
      <col style={{ width: '22%' }} />
      <col style={{ width: '20%' }} />
      <col style={{ width: '26%' }} />
      <col style={{ width: '14%' }} />
      <col style={{ width: '14%' }} />
    </colgroup>
  )
}

export default function TradeTable({ trades, symbol = 'BTC' }) {
  if (!trades.length) {
    return (
      <section className="tradeblock">
        <div className="label" style={{ marginBottom: 'var(--s3)' }}>
          Every trade: when bought, when sold, profit or loss
        </div>
        <table>
          <Cols />
          <Header />
          <tbody>
            <tr>
              <td colSpan="6" style={{ color: 'var(--mute)' }}>
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
        <Cols />
        <Header />
        <tbody>
          {trades.map((t, i) => {
            const cls = t.retNet >= 0 ? 'pos' : 'neg'
            return (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td className="num">{t.cf} · {price(t.cp)}</td>
                <td className="num">
                  {fmtQty(t.qty, symbol)}
                  <div style={{ color: 'var(--mute)', fontSize: 12 }}>
                    for {usdPrecise(t.investedUSD)}
                  </div>
                </td>
                <td className="num">
                  {t.vf
                    ? <>{t.vf} · {price(t.vp)} {reasonTag(t.reason)}</>
                    : <span style={{ color: 'var(--mute)' }}>open · {price(t.vp)} {reasonTag(t.reason)}</span>}
                </td>
                <td className={`r res num ${cls}`}>{pct(t.retNet)}</td>
                <td className={`r res num ${cls}`}>{signed(t.pnlUSD)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="tnote">
        Size = {symbol} bought and dollars invested at entry. With <b>compounding on</b>, position
        size grows or shrinks with previous results; with <b>fixed size</b>, every trade uses
        the same amount. P&amp;L is the real dollar gain or loss for each trade,
        net of 0.16% commission per side.
        Sold labels: <b>SL</b> = stop loss hit, <b>TP</b> = take profit hit, no tag = strategy signal.
      </div>
    </section>
  )
}

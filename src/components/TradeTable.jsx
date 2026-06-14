import { price, usdPrecise, signed, pct, qty as fmtQty } from '../lib/format.js'

function reasonTag(reason) {
  if (reason === 'SL') return <span className="tag tag-sl" title="Stop loss hit">SL</span>
  if (reason === 'TP') return <span className="tag tag-tp" title="Take profit hit">TP</span>
  if (reason === 'open') return <span className="tag tag-open" title="Still open at end of period">open</span>
  return null
}

function sideTag(side) {
  if (side === 'short') return <span className="tag tag-short" title="Short position">SHORT</span>
  return <span className="tag tag-long" title="Long position">LONG</span>
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
        <th className="r">Fees</th>
        <th className="r">P&amp;L</th>
      </tr>
    </thead>
  )
}

function Cols() {
  return (
    <colgroup>
      <col style={{ width: '4%' }} />
      <col style={{ width: '21%' }} />
      <col style={{ width: '18%' }} />
      <col style={{ width: '24%' }} />
      <col style={{ width: '12%' }} />
      <col style={{ width: '9%' }} />
      <col style={{ width: '12%' }} />
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
              <td colSpan="7" style={{ color: 'var(--mute)' }}>
                This strategy made no trades in the period.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    )
  }

  const totalFees = trades.reduce((s, t) => s + t.feeUSD, 0)
  const totalPnL = trades.reduce((s, t) => s + t.pnlUSD, 0)

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
                <td className="num">
                  {sideTag(t.side)} {t.cf} · {price(t.cp)}
                </td>
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
                <td className="r num" style={{ color: 'var(--mute)' }}>
                  {usdPrecise(t.feeUSD)}
                  <div style={{ fontSize: 11 }}>{t.sides === 1 ? '1 side' : '2 sides'}</div>
                </td>
                <td className={`r res num ${cls}`}>{signed(t.pnlUSD)}</td>
              </tr>
            )
          })}
          <tr style={{ borderTop: '1px solid var(--ink)' }}>
            <td colSpan="4" className="label" style={{ paddingTop: 'var(--s3)' }}>
              Totals
            </td>
            <td className="r" style={{ paddingTop: 'var(--s3)', color: 'var(--mute)' }}></td>
            <td className="r num" style={{ paddingTop: 'var(--s3)', color: 'var(--mute)' }}>
              {usdPrecise(totalFees)}
            </td>
            <td className={`r res num ${totalPnL >= 0 ? 'pos' : 'neg'}`} style={{ paddingTop: 'var(--s3)' }}>
              {signed(totalPnL)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="tnote">
        <b>LONG</b> = bought to open, sold to close (wins when price rises).{' '}
        <b>SHORT</b> = sold to open, bought to close (wins when price falls).
        Size = {symbol} traded and dollars committed at entry. With <b>compounding on</b>,
        position size grows or shrinks with previous results; with <b>fixed size</b>, every trade
        uses the same amount. <b>Fees</b> = 0.16% × committed × sides (2 = entry+exit, 1 = still-open).
        <b>P&amp;L</b> is the real dollar gain or loss for each trade, already net of fees.
        Sold labels: <b>SL</b> = stop loss hit, <b>TP</b> = take profit hit, no tag = strategy signal.
      </div>
    </section>
  )
}

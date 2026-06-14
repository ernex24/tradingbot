export default function Tabs({ tab, onChange, tradeCount }) {
  return (
    <div className="tabs">
      <button
        type="button"
        className={tab === 'backtest' ? 'tab active' : 'tab'}
        onClick={() => onChange('backtest')}
      >
        Backtest
      </button>
      <button
        type="button"
        className={tab === 'trades' ? 'tab active' : 'tab'}
        onClick={() => onChange('trades')}
      >
        Trades
        {tradeCount > 0 && <span className="tab-badge">{tradeCount}</span>}
      </button>
      <button
        type="button"
        className={tab === 'account' ? 'tab active' : 'tab'}
        onClick={() => onChange('account')}
      >
        Account
      </button>
    </div>
  )
}

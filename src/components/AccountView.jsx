import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured, authFetch } from '../lib/supabase.js'
import InfoTip from './InfoTip.jsx'

function LoginPanel({ onSession }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Account created. Check your email if confirmation is required, then sign in.')
        setMode('login')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session) onSession(data.session)
      }
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-panel">
      <div className="label">{mode === 'login' ? 'Sign in' : 'Create account'}</div>
      <form onSubmit={submit} className="auth-form">
        <input
          type="email" placeholder="email" value={email}
          onChange={e => setEmail(e.target.value)} required autoComplete="email"
        />
        <input
          type="password" placeholder="password (8+ chars)" value={password}
          onChange={e => setPassword(e.target.value)} required minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? '…' : (mode === 'login' ? 'Sign in' : 'Sign up')}
        </button>
      </form>
      <div className="auth-switch">
        <button
          type="button"
          className="link-btn"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setErr(''); setInfo('') }}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </div>
      {err && <div className="warn" style={{ marginTop: 12 }}>{err}</div>}
      {info && <div className="info-box" style={{ marginTop: 12 }}>{info}</div>}
    </div>
  )
}

function BinanceMainnetForm({ onSaved }) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const r = await authFetch('/api/keys/save', {
        method: 'POST',
        body: JSON.stringify({
          exchange: 'binance',
          testnet: false,
          apiKey, apiSecret,
          permissions: ['Spot Trading (mainnet)'],
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'failed to save')
      onSaved(data)
      setApiKey(''); setApiSecret('')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="key-form">
      <div className="key-warn">
        <b>⚠ REAL MONEY.</b> A leaked key with trade permissions can drain your account.
        Generate the key at <a href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noreferrer">binance.com → API Management</a> with ONLY:
        <ul>
          <li>✅ <b>Enable Spot &amp; Margin Trading</b></li>
          <li>✅ <b>Enable Reading</b> (default)</li>
          <li>❌ <b>NEVER</b> enable Withdrawals — worst case is someone tradeing your account, not draining it</li>
          <li>✅ Strongly recommended: IP whitelist <code>76.76.21.0/24</code> (Vercel Frankfurt)</li>
        </ul>
        Binance.com is not available in the US. If you're in the US, your only Binance option is Binance.US (different API).
      </div>

      <label>
        API Key
        <input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          autoComplete="off"
          required
        />
      </label>
      <label>
        Secret Key <InfoTip>Encrypted with AES-256-GCM before storage. Validated by calling /api/v3/account on mainnet.</InfoTip>
        <input
          type="password"
          value={apiSecret}
          onChange={e => setApiSecret(e.target.value)}
          autoComplete="off"
          required
        />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
        />
        <span>I understand this key controls real money and that any bot using mainnet will place real orders that can lose real funds.</span>
      </label>
      <button type="submit" className="btn" disabled={busy || !confirmed} style={{ background: '#991b1b', borderColor: '#991b1b' }}>
        {busy ? 'Validating with Binance Mainnet…' : 'Connect Binance Mainnet ⚠'}
      </button>
      {err && <div className="warn" style={{ marginTop: 12 }}>{err}</div>}
    </form>
  )
}

function BinanceTestnetForm({ onSaved }) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const r = await authFetch('/api/keys/save', {
        method: 'POST',
        body: JSON.stringify({
          exchange: 'binance',
          testnet: true,
          apiKey, apiSecret,
          permissions: ['Spot Trading (testnet)'],
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'failed to save')
      onSaved(data)
      setApiKey(''); setApiSecret('')
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="key-form">
      <div className="info-box">
        <b>Binance Testnet</b> is a sandbox — fake money, real API. Get your key:
        <ol style={{ margin: '6px 0 0 20px', padding: 0 }}>
          <li>Go to <a href="https://testnet.binance.vision/" target="_blank" rel="noreferrer">testnet.binance.vision</a></li>
          <li>Click <b>"Log In with GitHub"</b></li>
          <li>Generate HMAC_SHA256 key — copy <b>API Key</b> and <b>Secret Key</b> (secret only shows once)</li>
          <li>Paste them below</li>
        </ol>
        No KYC, no real money, no risk. Default permissions on testnet allow reading + trading.
      </div>

      <label>
        API Key
        <input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          autoComplete="off"
          required
          placeholder="64-char alphanumeric"
        />
      </label>
      <label>
        Secret Key <InfoTip>Encrypted with AES-256-GCM before storage. Validates by calling /api/v3/account on testnet.</InfoTip>
        <input
          type="password"
          value={apiSecret}
          onChange={e => setApiSecret(e.target.value)}
          autoComplete="off"
          required
          placeholder="64-char base64-ish string"
        />
      </label>
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Validating with Binance Testnet…' : 'Connect Binance Testnet'}
      </button>
      {err && <div className="warn" style={{ marginTop: 12 }}>{err}</div>}
    </form>
  )
}

function BinanceBalanceCard({ testnet, refreshKey }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    setErr(''); setLoading(true)
    try {
      const r = await authFetch(`/api/binance/balance?testnet=${testnet ? 1 : 0}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'failed')
      setData(d)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [refreshKey])

  const filtered = data?.balances?.filter(b =>
    !query || b.asset.toLowerCase().includes(query.toLowerCase())
  ) || []

  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })

  return (
    <div className="balance-card">
      <div className="balance-head">
        <div className="label">Binance{testnet ? ' Testnet' : ''} balance · live</div>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      {err && <div className="warn" style={{ marginTop: 8 }}>{err}</div>}
      {data && (
        <>
          <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6 }}>
            Account type: {data.accountType || '?'} · canTrade: {data.canTrade ? 'yes' : 'no'} ·
            permissions: {(data.permissions || []).join(', ') || '—'} ·
            {' '}{data.balances.length} assets
          </div>
          {data.balances.length > 0 && (
            <input
              type="search"
              className="balance-filter"
              placeholder="Filter by asset (e.g. BTC, USDT)…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          )}
          {data.balances.length === 0 ? (
            <div style={{ color: 'var(--mute)', padding: 'var(--s2) 0' }}>
              No assets with positive balance.
            </div>
          ) : (
            <div className="balance-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th className="r">Free</th>
                    <th className="r">Locked</th>
                    <th className="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ color: 'var(--mute)', padding: 'var(--s2) 0' }}>
                        No assets match "{query}".
                      </td>
                    </tr>
                  ) : filtered.map(b => (
                    <tr key={b.asset}>
                      <td>{b.asset}</td>
                      <td className="r num">{fmt(b.free)}</td>
                      <td className="r num">{fmt(b.locked)}</td>
                      <td className="r num"><b>{fmt(b.total)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const QUICK_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

function OrderPanel({ testnet, onAfterFill }) {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [side, setSide] = useState('BUY')
  const [type, setType] = useState('MARKET')
  const [quoteOrderQty, setQuoteOrderQty] = useState('100')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [openOrders, setOpenOrders] = useState([])

  const loadOpen = async () => {
    try {
      const r = await authFetch(`/api/binance/orders?testnet=${testnet ? 1 : 0}`)
      const d = await r.json()
      if (r.ok) setOpenOrders(d.orders || [])
    } catch {}
  }
  useEffect(() => { loadOpen() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setResult(null); setBusy(true)
    try {
      const body = { testnet: !!testnet, symbol, side, type }
      if (type === 'MARKET') {
        if (side === 'BUY' && quoteOrderQty) body.quoteOrderQty = +quoteOrderQty
        else if (quantity) body.quantity = +quantity
        else body.quoteOrderQty = +quoteOrderQty
      } else {
        body.quantity = +quantity
        body.price = +price
      }
      const r = await authFetch('/api/binance/order', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'failed')
      setResult(data)
      loadOpen()
      onAfterFill?.()
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const fmt = (n, d = 4) =>
    n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: d })

  return (
    <div className="order-panel">
      <div className="label" style={{ marginBottom: 'var(--s2)' }}>Place test order</div>

      <form onSubmit={submit} className="order-form">
        <div className="order-row">
          <label className="ofield">
            <span>Symbol</span>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}>
              {QUICK_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="ofield">
            <span>Side</span>
            <div className="side-toggle">
              <button
                type="button"
                className={'side-btn' + (side === 'BUY' ? ' on buy' : '')}
                onClick={() => setSide('BUY')}
              >BUY</button>
              <button
                type="button"
                className={'side-btn' + (side === 'SELL' ? ' on sell' : '')}
                onClick={() => setSide('SELL')}
              >SELL</button>
            </div>
          </label>

          <label className="ofield">
            <span>Type</span>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
            </select>
          </label>
        </div>

        {type === 'MARKET' && side === 'BUY' && (
          <label className="ofield ofield-wide">
            <span>Spend (USDT)</span>
            <input
              type="number" min="0" step="0.01"
              value={quoteOrderQty}
              onChange={e => setQuoteOrderQty(e.target.value)}
              placeholder="e.g. 100 = buy $100 worth"
            />
          </label>
        )}
        {type === 'MARKET' && side === 'SELL' && (
          <label className="ofield ofield-wide">
            <span>Quantity (base asset)</span>
            <input
              type="number" min="0" step="0.00001"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 0.001 BTC"
            />
          </label>
        )}
        {type === 'LIMIT' && (
          <div className="order-row">
            <label className="ofield">
              <span>Quantity</span>
              <input
                type="number" min="0" step="0.00001"
                value={quantity} onChange={e => setQuantity(e.target.value)}
              />
            </label>
            <label className="ofield">
              <span>Price (USDT)</span>
              <input
                type="number" min="0" step="0.01"
                value={price} onChange={e => setPrice(e.target.value)}
              />
            </label>
          </div>
        )}

        <button type="submit" className={'btn order-submit ' + (side === 'BUY' ? 'buy' : 'sell')} disabled={busy}>
          {busy ? 'Sending…' : `${side} ${symbol}`}
        </button>
        {err && <div className="warn" style={{ marginTop: 8 }}>{err}</div>}
      </form>

      {result && (
        <div className="order-result">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            ✓ Order #{result.orderId} {result.status}
          </div>
          <div style={{ fontSize: 13 }}>
            Filled <b>{fmt(result.executedQty, 8)}</b> of {result.symbol}
            {result.avgPrice != null && <> at avg <b>${fmt(result.avgPrice, 4)}</b></>}
            {' '}for total <b>${fmt(result.cummulativeQuoteQty, 4)} USDT</b>
          </div>
          {result.fills?.length > 0 && (
            <div className="fills-list">
              {result.fills.map((f, i) => (
                <div key={i} className="fill-line">
                  fill {i + 1}: {fmt(+f.qty, 8)} @ ${fmt(+f.price, 4)}
                  {' '}· fee {fmt(+f.commission, 8)} {f.commissionAsset}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {openOrders.length > 0 && (
        <div style={{ marginTop: 'var(--s4)' }}>
          <div className="label" style={{ marginBottom: 'var(--s2)' }}>
            Open orders ({openOrders.length})
          </div>
          <div className="balance-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Symbol</th><th>Side</th><th>Type</th>
                  <th className="r">Qty</th><th className="r">Filled</th>
                  <th className="r">Price</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.map(o => (
                  <tr key={o.orderId}>
                    <td className="num">{o.orderId}</td>
                    <td>{o.symbol}</td>
                    <td>{o.side}</td>
                    <td>{o.type}</td>
                    <td className="r num">{fmt(o.origQty, 8)}</td>
                    <td className="r num">{fmt(o.executedQty, 8)}</td>
                    <td className="r num">{fmt(o.price, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectedHeader({ keyInfo, label, badgeText, badgeClass, onDisconnect }) {
  const [busy, setBusy] = useState(false)
  const disconnect = async () => {
    if (!confirm(`Remove the stored ${label} key? You can add it again later.`)) return
    setBusy(true)
    try {
      const r = await authFetch('/api/keys/delete', {
        method: 'POST',
        body: JSON.stringify({ exchange: keyInfo.exchange, testnet: keyInfo.testnet }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'failed')
      }
      onDisconnect()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="connected-row">
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          <span className={`tag ${badgeClass}`}>{badgeText}</span>{' '}
          Connected · key ending in <code>…{keyInfo.keyHint}</code>
        </div>
        <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 2 }}>
          added {new Date(keyInfo.createdAt).toLocaleString('en-US')}
        </div>
      </div>
      <button type="button" className="btn-ghost btn-danger" onClick={disconnect} disabled={busy}>
        Disconnect
      </button>
    </div>
  )
}

function SafetySettings({ dailyLossLimit, onDailyLossLimitChange }) {
  const [limit, setLimit] = useState(dailyLossLimit ?? '')
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramConfigured, setTelegramConfigured] = useState(false)
  const [telegramEnabled, setTelegramEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await authFetch('/api/settings/get')
        if (!r.ok) return
        const { settings } = await r.json()
        if (cancelled) return
        setTelegramConfigured(!!settings?.telegramConfigured)
        setTelegramChatId(settings?.telegramChatId || '')
        setTelegramEnabled(settings?.telegramEnabled !== false)
        if (settings?.dailyLossLimit != null) setLimit(String(settings.dailyLossLimit))
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  const saveLimit = async () => {
    setBusy(true); setMsg('')
    try {
      const v = limit === '' ? null : Math.max(0, +limit)
      const r = await authFetch('/api/settings/save', {
        method: 'POST',
        body: JSON.stringify({ dailyLossLimit: v }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'failed')
      }
      onDailyLossLimitChange(v)
      setMsg(v == null ? 'Limit removed.' : `Limit set to ${v} USDT.`)
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally { setBusy(false) }
  }

  const saveTelegram = async () => {
    setBusy(true); setMsg('')
    try {
      const body = {}
      if (telegramBotToken) body.telegramBotToken = telegramBotToken
      if (telegramChatId) body.telegramChatId = telegramChatId
      body.telegramEnabled = telegramEnabled
      const r = await authFetch('/api/settings/save', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'failed')
      }
      if (telegramBotToken) setTelegramConfigured(true)
      setTelegramBotToken('')
      setMsg('Telegram settings saved.')
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally { setBusy(false) }
  }

  const sendTest = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await authFetch('/api/notify/telegram', {
        method: 'POST',
        body: JSON.stringify({ text: '✅ Test message from <b>Trend Bot</b>' }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'failed')
      setMsg(d.sent ? 'Test message sent.' : `Not sent: ${d.reason || 'unknown'}`)
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="exchange-block">
      <div className="exchange-head">
        <div style={{ fontSize: 15, fontWeight: 600 }}>Safety & notifications</div>
      </div>

      <div className="safety-row">
        <div>
          <div className="label">Daily loss limit (USDT)</div>
          <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 4 }}>
            If today's realized loss exceeds this, ALL bots are auto-paused.
            Leave empty to disable.
          </div>
        </div>
        <div className="safety-input">
          <input
            type="number" min="0" step="1"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            placeholder="e.g. 50"
            style={{ width: 120 }}
          />
          <button className="btn-ghost" onClick={saveLimit} disabled={busy}>Save</button>
        </div>
      </div>

      <div className="safety-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s3)' }}>
        <div>
          <div className="label">
            Telegram notifications
            <InfoTip>
              Get push notifications on Telegram for: entries, exits, daily-loss stop,
              reconciliation mismatches, emergency stops. Create a bot via @BotFather
              to get a token; get your chat id by messaging @userinfobot.
            </InfoTip>
          </div>
          <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 4 }}>
            {telegramConfigured ? '✓ Configured. Token stored encrypted.' : 'Not configured.'}
          </div>
        </div>
        <div className="safety-input safety-input-stack">
          <input
            type="password"
            value={telegramBotToken}
            onChange={e => setTelegramBotToken(e.target.value)}
            placeholder={telegramConfigured ? 'New bot token (leave empty to keep current)' : 'Bot token from @BotFather'}
            style={{ width: 280 }}
          />
          <input
            type="text"
            value={telegramChatId}
            onChange={e => setTelegramChatId(e.target.value)}
            placeholder="Chat ID (digits)"
            style={{ width: 280 }}
          />
          <label className="toggle">
            <input type="checkbox" checked={telegramEnabled} onChange={e => setTelegramEnabled(e.target.checked)} />
            <span>{telegramEnabled ? 'notifications on' : 'notifications off'}</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={saveTelegram} disabled={busy}>Save Telegram</button>
            {telegramConfigured && (
              <button className="btn-ghost" onClick={sendTest} disabled={busy}>Send test</button>
            )}
          </div>
        </div>
      </div>

      {msg && <div className="info-box" style={{ marginTop: 'var(--s3)' }}>{msg}</div>}
    </div>
  )
}

export default function AccountView({ dailyLossLimit, onDailyLossLimitChange }) {
  const [session, setSession] = useState(null)
  const [keys, setKeys] = useState(null)
  const [loading, setLoading] = useState(true)
  const [balanceRefresh, setBalanceRefresh] = useState(0)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false

    // Safety timeout: if getSession somehow hangs (corrupted local
    // session, refresh stuck, etc.) we still drop into the login form
    // after 5s rather than leaving the user stuck on "Loading…".
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 5000)

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.warn('[auth] getSession error:', error)
        setSession(data?.session || null)
        setLoading(false)
        clearTimeout(safety)
      })
      .catch(e => {
        if (cancelled) return
        console.warn('[auth] getSession threw:', e)
        setLoading(false)
        clearTimeout(safety)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (cancelled) return
      setSession(s || null)
    })

    return () => {
      cancelled = true
      clearTimeout(safety)
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  const refreshKeys = async () => {
    try {
      const r = await authFetch('/api/keys/status')
      const data = await r.json()
      setKeys(data.keys || [])
    } catch { setKeys([]) }
  }
  useEffect(() => {
    if (session) refreshKeys()
    else setKeys(null)
  }, [session])

  if (!supabaseConfigured) {
    return (
      <div className="account-view">
        <div className="label">Account</div>
        <div className="warn" style={{ marginTop: 12 }}>
          Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to your Vercel environment variables and redeploy.
        </div>
      </div>
    )
  }

  if (loading) return <div className="account-view"><div className="label">Loading…</div></div>

  if (!session) {
    return (
      <div className="account-view">
        <div className="label">Account</div>
        <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 4 }}>
          Sign in to connect your exchange accounts. Credentials are encrypted at rest.
        </div>
        <LoginPanel onSession={setSession} />
      </div>
    )
  }

  const binanceTestnetKey = (keys || []).find(k => k.exchange === 'binance' && k.testnet)
  const binanceMainnetKey = (keys || []).find(k => k.exchange === 'binance' && !k.testnet)

  return (
    <div className="account-view">
      <div className="account-head">
        <div>
          <div className="label">Account</div>
          <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 4 }}>
            Signed in as <b>{session.user.email}</b>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      {/* Binance Testnet — fake money, primary integration */}
      <div className="exchange-block">
        <div className="exchange-head">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Binance</div>
          <span className="tag tag-testnet">TESTNET</span>
          <span style={{ color: 'var(--mute)', fontSize: 12 }}>· fake money, real API</span>
        </div>
        {keys === null ? (
          <div style={{ color: 'var(--mute)' }}>Loading…</div>
        ) : binanceTestnetKey ? (
          <>
            <ConnectedHeader
              keyInfo={binanceTestnetKey}
              label="Binance Testnet"
              badgeText="TESTNET"
              badgeClass="tag-testnet"
              onDisconnect={refreshKeys}
            />
            <div style={{ marginTop: 'var(--s4)' }}>
              <BinanceBalanceCard testnet={true} refreshKey={balanceRefresh} />
            </div>
            <div style={{ marginTop: 'var(--s4)' }}>
              <OrderPanel testnet={true} onAfterFill={() => setBalanceRefresh(k => k + 1)} />
            </div>
          </>
        ) : (
          <BinanceTestnetForm onSaved={() => refreshKeys()} />
        )}
      </div>

      {/* Binance Mainnet — REAL MONEY */}
      <div className="exchange-block">
        <div className="exchange-head">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Binance</div>
          <span className="tag tag-mainnet">MAINNET</span>
          <span style={{ color: 'var(--mute)', fontSize: 12 }}>· real money</span>
        </div>
        {keys === null ? (
          <div style={{ color: 'var(--mute)' }}>Loading…</div>
        ) : binanceMainnetKey ? (
          <>
            <ConnectedHeader
              keyInfo={binanceMainnetKey}
              label="Binance Mainnet"
              badgeText="MAINNET ⚠"
              badgeClass="tag-mainnet"
              onDisconnect={refreshKeys}
            />
            <div className="mainnet-banner">
              ⚠ Bots created with the MAINNET button will use this key to place real orders.
            </div>
            <div style={{ marginTop: 'var(--s4)' }}>
              <BinanceBalanceCard testnet={false} refreshKey={balanceRefresh} />
            </div>
            <div style={{ marginTop: 'var(--s4)' }}>
              <OrderPanel testnet={false} onAfterFill={() => setBalanceRefresh(k => k + 1)} />
            </div>
          </>
        ) : (
          <BinanceMainnetForm onSaved={() => refreshKeys()} />
        )}
      </div>

      <SafetySettings
        dailyLossLimit={dailyLossLimit}
        onDailyLossLimitChange={onDailyLossLimitChange}
      />
    </div>
  )
}

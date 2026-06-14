import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured, authFetch } from '../lib/supabase.js'
import InfoTip from './InfoTip.jsx'

const KRAKEN_READ_PERMS = ['Query Funds', 'Query Open Orders & Trades', 'Query Closed Orders & Trades']

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

function BinanceBalanceCard({ testnet }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

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
  useEffect(() => { load() }, [])

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
            permissions: {(data.permissions || []).join(', ') || '—'}
          </div>
          {data.balances.length === 0 ? (
            <div style={{ color: 'var(--mute)', padding: 'var(--s2) 0' }}>
              No assets with positive balance.
            </div>
          ) : (
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th className="r">Free</th>
                  <th className="r">Locked</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.balances.map(b => (
                  <tr key={b.asset}>
                    <td>{b.asset}</td>
                    <td className="r num">{b.free.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                    <td className="r num">{b.locked.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                    <td className="r num"><b>{b.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

function KrakenKeyForm({ onSaved }) {
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
          exchange: 'kraken',
          testnet: false,
          apiKey, apiSecret,
          permissions: KRAKEN_READ_PERMS,
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
        <b>Kraken is real money.</b> Your key must have <b>only these three permissions</b>:
        <ul>
          {KRAKEN_READ_PERMS.map(p => <li key={p}>{p}</li>)}
        </ul>
        <b>Never enable Withdraw Funds.</b> We validate by making a real Balance call before saving.
      </div>
      <label>
        API Key
        <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" required />
      </label>
      <label>
        API Secret
        <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} autoComplete="off" required />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        <span>I confirm this key has ONLY the three read-only permissions listed above.</span>
      </label>
      <button type="submit" className="btn" disabled={busy || !confirmed}>
        {busy ? 'Validating with Kraken…' : 'Connect Kraken'}
      </button>
      {err && <div className="warn" style={{ marginTop: 12 }}>{err}</div>}
    </form>
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

export default function AccountView() {
  const [session, setSession] = useState(null)
  const [keys, setKeys] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s || null)
    })
    return () => sub?.subscription?.unsubscribe?.()
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
  const krakenKey = (keys || []).find(k => k.exchange === 'kraken')

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
              <BinanceBalanceCard testnet={true} />
            </div>
          </>
        ) : (
          <BinanceTestnetForm onSaved={() => refreshKeys()} />
        )}
      </div>

      {/* Kraken — real money, read-only */}
      <div className="exchange-block">
        <div className="exchange-head">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Kraken</div>
          <span className="tag tag-real">REAL · read-only</span>
        </div>
        {keys === null ? (
          <div style={{ color: 'var(--mute)' }}>Loading…</div>
        ) : krakenKey ? (
          <ConnectedHeader
            keyInfo={krakenKey}
            label="Kraken"
            badgeText="REAL"
            badgeClass="tag-real"
            onDisconnect={refreshKeys}
          />
        ) : (
          <KrakenKeyForm onSaved={() => refreshKeys()} />
        )}
      </div>
    </div>
  )
}

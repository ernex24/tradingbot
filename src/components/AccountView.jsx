import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured, authFetch } from '../lib/supabase.js'
import InfoTip from './InfoTip.jsx'

const READ_PERMS = ['Query Funds', 'Query Open Orders & Trades', 'Query Closed Orders & Trades']

function LoginPanel({ onSession }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
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
        setInfo('Account created. Check your email if confirmation is required, then log in.')
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
          apiKey, apiSecret,
          permissions: READ_PERMS,
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
        <b>Before pasting:</b> your Kraken key must have <b>only these three permissions</b>:
        <ul>
          {READ_PERMS.map(p => <li key={p}>{p}</li>)}
        </ul>
        Specifically <b>do NOT</b> enable Modify Orders, Cancel Orders, Deposit Funds, or
        Withdraw Funds. We validate this by making a real call before saving.
      </div>

      <label>
        API Key
        <input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          autoComplete="off"
          required
          placeholder="public part — starts with letters/digits"
        />
      </label>
      <label>
        API Secret <InfoTip>The private part. Encrypted with AES-256-GCM before storing. We never log it.</InfoTip>
        <input
          type="password"
          value={apiSecret}
          onChange={e => setApiSecret(e.target.value)}
          autoComplete="off"
          required
          placeholder="long base64 string"
        />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
        />
        <span>I confirm this key has ONLY the three read-only permissions listed above.</span>
      </label>
      <button type="submit" className="btn" disabled={busy || !confirmed}>
        {busy ? 'Validating with Kraken…' : 'Connect Kraken'}
      </button>
      {err && <div className="warn" style={{ marginTop: 12 }}>{err}</div>}
    </form>
  )
}

function BalanceCard() {
  const [balances, setBalances] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setErr(''); setLoading(true)
    try {
      const r = await authFetch('/api/kraken/balance')
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'failed')
      setBalances(data.balances)
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
        <div className="label">Kraken balance · live</div>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      {err && <div className="warn" style={{ marginTop: 8 }}>{err}</div>}
      {balances && balances.length === 0 && (
        <div style={{ color: 'var(--mute)', padding: 'var(--s2) 0' }}>
          No funds with positive balance.
        </div>
      )}
      {balances && balances.length > 0 && (
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Asset</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {balances.map(b => (
              <tr key={b.asset}>
                <td>{b.asset}</td>
                <td className="r num">{b.amount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ConnectedPanel({ keyInfo, onDisconnect }) {
  const [busy, setBusy] = useState(false)
  const disconnect = async () => {
    if (!confirm('Remove the stored Kraken key? You can add it again later.')) return
    setBusy(true)
    try {
      const r = await authFetch('/api/keys/delete', {
        method: 'POST',
        body: JSON.stringify({ exchange: 'kraken' }),
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
    <div>
      <div className="connected-row">
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            Kraken connected · key ending in <code>…{keyInfo.keyHint}</code>
          </div>
          <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 2 }}>
            added {new Date(keyInfo.createdAt).toLocaleString('en-US')} ·
            permissions: {(keyInfo.permissions || []).join(', ') || '—'}
          </div>
        </div>
        <button type="button" className="btn-ghost btn-danger" onClick={disconnect} disabled={busy}>
          Disconnect
        </button>
      </div>
      <div style={{ marginTop: 'var(--s4)' }}>
        <BalanceCard />
      </div>
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

  useEffect(() => {
    if (!session) { setKeys(null); return }
    authFetch('/api/keys/status').then(r => r.json()).then(data => {
      setKeys(data.keys || [])
    }).catch(() => setKeys([]))
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
          Sign in to connect your Kraken account. Credentials are encrypted at rest.
        </div>
        <LoginPanel onSession={setSession} />
      </div>
    )
  }

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
        <button
          type="button"
          className="btn-ghost"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>

      <div className="exchange-block">
        <div className="exchange-head">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Kraken</div>
          <span className="tag tag-src tag-src-kraken">read-only</span>
        </div>
        {keys === null ? (
          <div style={{ color: 'var(--mute)', padding: 'var(--s2) 0' }}>Loading…</div>
        ) : krakenKey ? (
          <ConnectedPanel
            keyInfo={krakenKey}
            onDisconnect={() => setKeys(prev => (prev || []).filter(k => k.exchange !== 'kraken'))}
          />
        ) : (
          <KrakenKeyForm
            onSaved={(saved) => setKeys(prev => [
              ...(prev || []),
              {
                exchange: saved.exchange,
                keyHint: saved.keyHint,
                permissions: READ_PERMS,
                createdAt: new Date().toISOString(),
              },
            ])}
          />
        )}
      </div>
    </div>
  )
}

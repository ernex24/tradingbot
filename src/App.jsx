import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_CANDLES } from './lib/demoData.js'
import { STRATS } from './lib/strategies.js'
import { backtest } from './lib/backtest.js'
import { coinByPair } from './lib/coins.js'
import { createInitialState, floatingPnL } from './lib/paperTrader.js'
import { executeTick as binanceTick, executorSupportsCoin, closeOpenPosition } from './lib/binanceExecutor.js'
import { binanceStream } from './lib/binanceStream.js'
import { supabase, authFetch } from './lib/supabase.js'
import { usdPrecise, signed } from './lib/format.js'
import { usePath, pathToTab, tabToPath } from './lib/router.js'
import { notify } from './lib/notify.js'
import Tabs from './components/Tabs.jsx'
import Controls from './components/Controls.jsx'
import KPIs from './components/KPIs.jsx'
import PriceChart from './components/PriceChart.jsx'
import EquityChart from './components/EquityChart.jsx'
import TradeTable from './components/TradeTable.jsx'
import TradesView from './components/TradesView.jsx'
import AccountView from './components/AccountView.jsx'

const BOTS_STORAGE_KEY = 'paperBots.v2'
const POLL_MS = 30000

function loadBots() {
  try {
    const raw = localStorage.getItem(BOTS_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    // Drop the old paper bots — only live Testnet bots are supported now.
    return list.filter(b => b.config?.executor === 'binance-testnet')
  } catch { return [] }
}
function saveBots(bots) {
  try {
    const slim = bots.map(b => ({
      ...b,
      state: { ...b.state, candles: undefined },
    }))
    localStorage.setItem(BOTS_STORAGE_KEY, JSON.stringify(slim))
  } catch {}
}

function defaultParams(stratKey) {
  const out = {}
  STRATS[stratKey].params.forEach(p => { out[p.k] = p.def })
  return out
}

const datePart = s => (s ? s.slice(0, 10) : '')

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export default function App() {
  const [path, navigate] = usePath()
  const tab = pathToTab(path)
  const setTab = (next) => navigate(tabToPath(next))

  const [candles, setCandles] = useState(DEMO_CANDLES)
  const [dataSrc, setDataSrc] = useState('loading live data…')
  const [updatedAt, setUpdatedAt] = useState('')
  const [stratKey, setStratKey] = useState('ma')
  const [params, setParams] = useState(() => defaultParams('ma'))
  const [pair, setPair] = useState('BTC')
  const [interval, setIntervalState] = useState('1d')
  const [stopPct, setStopPct] = useState(0)
  const [takePct, setTakePct] = useState(0)
  const [stake, setStake] = useState(1000)
  const [compound, setCompound] = useState(true)
  const [direction, setDirection] = useState('long')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [bots, setBots] = useState(() => loadBots())
  const [usdtBalance, setUsdtBalance] = useState(null)
  // Full balance list for the active network. Drives the hover tooltip
  // on the header USDT cell so the user can see every asset balance
  // without leaving the page.
  const [allBalances, setAllBalances] = useState([])
  const [dailyLossLimit, setDailyLossLimit] = useState(null)
  const [reconciliationWarnings, setReconciliationWarnings] = useState({})
  const [networkView, setNetworkView] = useState('testnet')
  const [backtestStarted, setBacktestStarted] = useState(false)
  const [pendingCreate, setPendingCreate] = useState(null)
  // All historical trades on the user's account, persisted across bot
  // deletions. Feeds the Bots tab KPI ribbon so lifetime totals per
  // network survive even when bots are deleted.
  const [allTrades, setAllTrades] = useState([])
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('trendbot.theme') || 'light'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('trendbot.theme', theme) } catch {}
  }, [theme])
  useEffect(() => { saveBots(bots) }, [bots])

  const coin = coinByPair(pair)

  const minDate = datePart(candles[0]?.f)
  const maxDate = datePart(candles[candles.length - 1]?.f)
  const [desde, setDesde] = useState(minDate)
  const [hasta, setHasta] = useState(maxDate)

  useEffect(() => {
    setDesde(minDate)
    setHasta(maxDate)
  }, [minDate, maxDate])

  const visibleCandles = useMemo(() => {
    if (!desde && !hasta) return candles
    const lo = desde || minDate
    const hi = hasta || maxDate
    return candles.filter(c => {
      const d = datePart(c.f)
      return d >= lo && d <= hi
    })
  }, [candles, desde, hasta, minDate, maxDate])

  const S = STRATS[stratKey]
  const paramError = S.validar ? S.validar(params) : null

  let rangeWarn = ''
  if (desde && hasta && desde > hasta) {
    rangeWarn = '"From" date is later than "To" date.'
  } else if (visibleCandles.length < 30) {
    rangeWarn = `Only ${visibleCandles.length} candles in range — need more data for a meaningful backtest.`
  }

  const effectiveDirection = S.supportsDirection ? direction : 'long'

  const result = useMemo(() => {
    if (paramError || rangeWarn) return null
    if (visibleCandles.length < 2) return null
    const { pos, lines } = S.run(visibleCandles, params, effectiveDirection)
    return {
      ...backtest(visibleCandles, pos, { stopPct, takePct, stake, compound }),
      lines,
    }
  }, [visibleCandles, stratKey, params, paramError, rangeWarn, S, effectiveDirection, stopPct, takePct, stake, compound])

  // Track user interaction with the Backtest controls. Until the user
  // changes anything in Market / Strategy / Money & risk, the page
  // shows an empty state instead of auto-computed results.
  const markStarted = () => { if (!backtestStarted) setBacktestStarted(true) }

  const handleStratChange = key => {
    markStarted()
    setStratKey(key)
    setParams(defaultParams(key))
  }
  const handleParamChange = (k, v) => {
    markStarted()
    setParams(prev => ({ ...prev, [k]: v }))
  }
  const handleDateChange = (which, value) => {
    markStarted()
    if (which === 'desde') setDesde(value || minDate)
    else setHasta(value || maxDate)
  }

  const cargarOhlc = async (forceInterval, forcePair) => {
    const iv = forceInterval ?? interval
    const pr = forcePair ?? pair
    const co = coinByPair(pr)
    setLoading(true)
    setLoadError('')
    try {
      const r = await fetch(`/api/ohlc?coin=${pr}&interval=${iv}`)
      const data = await r.json()
      if (!r.ok || data.error) {
        throw new Error(data.error || ('HTTP ' + r.status))
      }
      const rows = data.candles
      const intraday = iv !== '1d'
      const next = rows.map(row => {
        const iso = new Date(row.t).toISOString()
        return {
          f: intraday ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10),
          o: row.o, h: row.h, l: row.l, c: row.c,
        }
      })
      setCandles(next)
      setDataSrc(`live · Binance · ${co.symbol} · ${iv} · ${next.length} candles`)
      setUpdatedAt('Updated ' + new Date().toLocaleString('en-US'))
    } catch (e) {
      console.warn('OHLC fetch failed:', e)
      setLoadError('Could not load live data (' + e.message + '). Using demo.')
      setDataSrc('live source unavailable — using demo')
    } finally {
      setLoading(false)
    }
  }

  const handleIntervalChange = (iv) => {
    markStarted()
    setIntervalState(iv)
    cargarOhlc(iv, pair)
  }
  const handlePairChange = (pr) => {
    markStarted()
    setPair(pr)
    cargarOhlc(interval, pr)
  }

  useEffect(() => {
    cargarOhlc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bot config + state persistence -----------------------------------
  // Saves on every meaningful change: bot list grew/shrank, open
  // position appeared/disappeared, closedTrades count changed,
  // running/name toggled. Tick-only updates (lastPrice, lastTickAt)
  // do NOT trigger a save — they'd flood the DB with no value.
  const lastBotSnapshot = useRef(new Map())

  const saveBotToDB = async (bot) => {
    try {
      await authFetch('/api/bots/save', {
        method: 'POST',
        body: JSON.stringify({
          id: bot.id,
          name: bot.name,
          config: bot.config,
          state: bot.state,
          running: bot.running,
          serverManaged: bot.serverManaged !== false,
        }),
      })
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || cancelled) return

        const currentIds = new Set()
        for (const bot of bots) {
          currentIds.add(bot.id)
          const prev = lastBotSnapshot.current.get(bot.id)
          const curr = {
            name: bot.name,
            hasOpen: !!bot.state.openPosition,
            closedCount: bot.state.closedTrades.length,
            running: bot.running,
            cash: Math.round(bot.state.cash * 100) / 100,
          }
          const significant = !prev ||
            prev.name !== curr.name ||
            prev.hasOpen !== curr.hasOpen ||
            prev.closedCount !== curr.closedCount ||
            prev.running !== curr.running
          if (significant) {
            lastBotSnapshot.current.set(bot.id, curr)
            saveBotToDB(bot)
          }
        }

        for (const id of Array.from(lastBotSnapshot.current.keys())) {
          if (!currentIds.has(id)) {
            lastBotSnapshot.current.delete(id)
          }
        }
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [bots])

  // Hydrate bots from DB on auth ready. DB bots merge with localStorage
  // bots: matched by id, DB version wins. localStorage bots not in DB
  // get pushed up (so a logged-in user can adopt offline bots).
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const load = async (session) => {
      if (!session) return
      try {
        const r = await authFetch('/api/bots/list')
        if (!r.ok) return
        const { bots: dbBotsRaw = [] } = await r.json()
        if (cancelled) return

        // Drop tombstoned IDs (recently deleted, DB delete maybe not
        // observed yet) and expire stale tombstones.
        const now = Date.now()
        for (const [tid, expiry] of deletedIds.current) {
          if (expiry < now) deletedIds.current.delete(tid)
        }
        const dbBots = dbBotsRaw.filter(b => !deletedIds.current.has(b.id))

        const dbMap = new Map(dbBots.map(b => [b.id, b]))
        setBots(prev => {
          const localMap = new Map(prev.map(b => [b.id, b]))
          // Push any local bot not in DB
          for (const local of prev) {
            if (!dbMap.has(local.id)) {
              saveBotToDB(local)
            }
          }
          // Build merged list — DB wins for state/config, but keep
          // local candles + closedTrades + lastPrice (DB strips them).
          const merged = []
          const seenIds = new Set()
          for (const db of dbBots) {
            seenIds.add(db.id)
            const local = localMap.get(db.id)
            merged.push({
              id: db.id,
              name: db.name,
              createdAt: db.createdAt,
              running: db.running,
              serverManaged: db.serverManaged !== false,
              config: db.config,
              state: {
                ...db.state,
                closedTrades: local?.state?.closedTrades ?? [],
                candles: local?.state?.candles,
                lastPrice: local?.state?.lastPrice ?? db.state?.lastPrice ?? null,
                lastTickAt: local?.state?.lastTickAt ?? db.state?.lastTickAt ?? null,
              },
            })
            // Mark snapshot so the watcher doesn't immediately re-save
            lastBotSnapshot.current.set(db.id, {
              name: db.name,
              hasOpen: !!db.state?.openPosition,
              closedCount: local?.state?.closedTrades?.length ?? 0,
              running: db.running,
              cash: Math.round((db.state?.cash ?? 0) * 100) / 100,
            })
          }
          for (const local of prev) {
            if (!seenIds.has(local.id)) merged.push(local)
          }
          return merged
        })
      } catch { /* ignore */ }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s))
    // Re-poll bot state every 20s so cron-driven changes (server-managed
    // bots) surface in the UI without a manual refresh.
    const poll = setInterval(async () => {
      const { data } = await supabase.auth.getSession()
      load(data.session)
    }, 20_000)
    return () => {
      cancelled = true
      clearInterval(poll)
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  // Closed-trade persistence ----------------------------------------
  // localStorage is the working copy. On every state change, mirror
  // any new closed trades to Supabase. On auth ready, pull any DB
  // trades the browser doesn't already have. Tracked-as-saved set lives
  // in a ref so the effect can dedupe across renders.
  const savedTradeKeys = useRef(new Set())

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || cancelled) return
        const toSave = []
        for (const bot of bots) {
          for (const t of bot.state.closedTrades) {
            const key = `${bot.id}|${t.entryTime}|${t.exitTime}`
            if (savedTradeKeys.current.has(key)) continue
            savedTradeKeys.current.add(key)
            toSave.push({ bot, trade: t, key })
          }
        }
        if (!toSave.length) return
        await Promise.all(toSave.map(async ({ bot, trade, key }) => {
          try {
            const r = await authFetch('/api/trades/save', {
              method: 'POST',
              body: JSON.stringify({
                botId: bot.id,
                botName: bot.name,
                symbol: bot.config.pair,
                side: trade.side,
                testnet: bot.config.executor === 'binance-testnet',
                entryTime: trade.entryTime,
                entryPrice: trade.entryPrice,
                qty: trade.qty,
                invested: trade.invested,
                exitTime: trade.exitTime,
                exitPrice: trade.exitPrice,
                pnlUSD: trade.pnlUSD,
                netPct: trade.netPct,
                feeUSD: trade.feeUSD ?? 0,
                reason: trade.reason,
                entryOrderId: trade.entryOrderId,
                exitOrderId: trade.exitOrderId,
              }),
            })
            if (!r.ok) savedTradeKeys.current.delete(key)
          } catch {
            savedTradeKeys.current.delete(key)
          }
        }))
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [bots])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const load = async (session) => {
      if (!session) return
      try {
        const r = await authFetch('/api/trades/list')
        if (!r.ok) return
        const { trades = [] } = await r.json()
        if (cancelled) return
        // Cache the lifetime trade list — drives the Bots tab KPI ribbon
        // so totals stay accurate even after the originating bot is gone.
        setAllTrades(trades)
        if (!trades.length) return
        const byBot = new Map()
        for (const t of trades) {
          const key = `${t.botId}|${t.entryTime}|${t.exitTime}`
          savedTradeKeys.current.add(key)
          const list = byBot.get(t.botId) || []
          list.push(t)
          byBot.set(t.botId, list)
        }
        setBots(prev => prev.map(b => {
          const dbTrades = byBot.get(b.id)
          if (!dbTrades) return b
          const seen = new Set()
          const merged = []
          const push = (t) => {
            const k = `${t.entryTime}|${t.exitTime}`
            if (seen.has(k)) return
            seen.add(k)
            merged.push(t)
          }
          dbTrades.forEach(push)
          b.state.closedTrades.forEach(push)
          merged.sort((a, b) => (a.entryTime || 0) - (b.entryTime || 0))
          return { ...b, state: { ...b.state, closedTrades: merged } }
        }))
      } catch { /* ignore */ }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s))
    // Refresh lifetime trades every 60s so deletes / new closes surface
    // in the persistent KPI ribbon without a manual reload.
    const poll = setInterval(async () => {
      const { data } = await supabase.auth.getSession()
      load(data.session)
    }, 60_000)
    return () => {
      cancelled = true
      clearInterval(poll)
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  // Settings load (daily limit, Telegram on/off flags) --------------
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const load = async (session) => {
      if (!session) return
      try {
        const r = await authFetch('/api/settings/get')
        if (!r.ok) return
        const { settings } = await r.json()
        if (cancelled) return
        setDailyLossLimit(settings?.dailyLossLimit ?? null)
      } catch { /* ignore */ }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => load(s))
    return () => { cancelled = true; sub?.subscription?.unsubscribe?.() }
  }, [])

  // Periodic reconciliation -----------------------------------------
  // Every 5 minutes, for each bot with an open position, ask Binance
  // for the actual balance of that coin. If it's materially less than
  // what the bot expects (allowing 5% slack for fees/other bots), flag
  // the bot — and notify.
  useEffect(() => {
    if (!supabase) return
    const reconcile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const openBots = botsRef.current.filter(b => b.state.openPosition)
        if (!openBots.length) return

        // Group by testnet flag — separate balance fetches per network.
        const networks = new Set(openBots.map(b => b.config.testnet !== false ? 1 : 0))
        const byNetwork = {}
        for (const net of networks) {
          try {
            const r = await authFetch(`/api/binance/balance?testnet=${net}`)
            if (!r.ok) continue
            const data = await r.json()
            const map = {}
            for (const b of data.balances || []) map[b.asset] = b.total
            byNetwork[net] = map
          } catch { /* ignore */ }
        }

        const next = {}
        for (const bot of openBots) {
          const op = bot.state.openPosition
          const net = bot.config.testnet !== false ? 1 : 0
          const balances = byNetwork[net]
          if (!balances) continue
          const have = balances[bot.config.pair] ?? 0
          const expected = op.qty
          if (have < expected * 0.95) {
            next[bot.id] = {
              expected,
              actual: have,
              coin: bot.config.pair,
            }
            notify(`⚠ <b>Reconciliation mismatch</b>\nBot: ${bot.name}\nExpected ${expected.toFixed(6)} ${bot.config.pair}, found ${have.toFixed(6)}.\nBot will be paused.`)
          }
        }
        setReconciliationWarnings(next)
        if (Object.keys(next).length) {
          const mismatchIds = new Set(Object.keys(next))
          setBots(prev => prev.map(b =>
            mismatchIds.has(b.id) ? { ...b, running: false } : b
          ))
        }
      } catch { /* ignore */ }
    }
    reconcile()
    const id = setInterval(reconcile, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // USDT balance polling --------------------------------------------
  // Polls the user's Binance USDT balance every 60s when signed in.
  // Switches between testnet/mainnet automatically when networkView
  // changes. Silent on auth/network failure; the header shows "—".
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    setUsdtBalance(null)
    setAllBalances([])
    const testnetFlag = networkView === 'testnet' ? 1 : 0
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          if (!cancelled) {
            setUsdtBalance(null)
            setAllBalances([])
          }
          return
        }
        const r = await authFetch(`/api/binance/balance?testnet=${testnetFlag}`)
        if (!r.ok) return
        const data = await r.json()
        if (cancelled) return
        const balances = data.balances || []
        const usdt = balances.find(b => b.asset === 'USDT')
        setUsdtBalance(usdt ? usdt.total : 0)
        setAllBalances(balances)
      } catch { /* ignore */ }
    }
    load()
    const id = setInterval(load, 60_000)
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => {
      cancelled = true
      clearInterval(id)
      sub?.subscription?.unsubscribe?.()
    }
  }, [networkView])

  // Filtered bots for the currently-selected network view --------
  const networkBots = useMemo(() => bots.filter(b => {
    const isTestnet = b.config.testnet !== false
    return networkView === 'testnet' ? isTestnet : !isTestnet
  }), [bots, networkView])

  // Total unrealised P&L: sum of every open bot's floating P&L
  // (limited to the selected network).
  const unrealisedPnL = networkBots.reduce((sum, bot) => {
    if (!bot.state.openPosition || !bot.state.lastPrice) return sum
    return sum + floatingPnL(bot.state.openPosition, bot.state.lastPrice)
  }, 0)
  const anyOpen = networkBots.some(b => b.state.openPosition)

  // Safety: today's realized P&L (limited to the selected network) -
  const todayPnL = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const cutoff = startOfToday.getTime()
    let sum = 0
    for (const bot of networkBots) {
      for (const t of bot.state.closedTrades) {
        if (t.exitTime > cutoff) sum += t.pnlUSD || 0
      }
    }
    return sum
  }, [networkBots])

  const dailyLimitTriggeredRef = useRef(false)
  useEffect(() => {
    if (!dailyLossLimit || dailyLossLimit <= 0) return
    if (todayPnL >= -dailyLossLimit) {
      dailyLimitTriggeredRef.current = false
      return
    }
    if (dailyLimitTriggeredRef.current) return
    const hasRunning = bots.some(b => b.running)
    if (!hasRunning) return
    dailyLimitTriggeredRef.current = true
    setBots(prev => prev.map(b => ({ ...b, running: false })))
    notify(`🛑 <b>Daily loss limit hit</b>\nToday: ${todayPnL.toFixed(2)} USDT (limit −${dailyLossLimit} USDT)\nAll bots paused.`)
  }, [todayPnL, dailyLossLimit, bots])

  // Reset the trigger at midnight so the next day starts clean.
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const delay = midnight.getTime() - now.getTime()
    const t = setTimeout(() => { dailyLimitTriggeredRef.current = false }, delay)
    return () => clearTimeout(t)
  }, [])

  const handleEmergencyStop = () => {
    const running = bots.filter(b => b.running)
    if (running.length === 0) return
    if (!window.confirm(`Pause all ${running.length} running bot${running.length === 1 ? '' : 's'} immediately?`)) return
    setBots(prev => prev.map(b => ({ ...b, running: false })))
    notify(`🛑 <b>Emergency stop activated</b>\n${running.length} bot${running.length === 1 ? '' : 's'} paused.`)
  }

  // Bot management --------------------------------------------------

  const currentConfigLabel = `${coin.symbol} · ${S.nombre} · ${effectiveDirection}`

  const handleCreateBot = (network = 'testnet') => {
    const id = newId()
    const isMainnet = network === 'mainnet'
    const networkSuffix = isMainnet ? ' · MAINNET' : ''
    const baseName = currentConfigLabel + networkSuffix
    const sameNameCount = bots.filter(b => b.name.startsWith(baseName)).length
    const name = sameNameCount > 0 ? `${baseName} #${sameNameCount + 1}` : baseName
    const bot = {
      id,
      name,
      createdAt: Date.now(),
      running: true,
      serverManaged: true,
      config: {
        pair, source: 'binance', interval,
        stratKey,
        params: { ...params },
        direction,
        effectiveDirection,
        stopPct, takePct,
        stake, compound,
        executor: isMainnet ? 'binance-mainnet' : 'binance-testnet',
        testnet: !isMainnet,
      },
      state: createInitialState(stake),
    }
    setBots(prev => [...prev, bot])
    setTab('trades')
  }
  const handleToggleBot = (id) => {
    setBots(prev => prev.map(b => b.id === id ? { ...b, running: !b.running } : b))
  }
  // Tombstones suppress recently-deleted bot IDs so the 20s Supabase
  // poll can't resurrect them before the DB delete is observed.
  // 5-minute TTL is generous; any DB delete completes in <1s in practice.
  const deletedIds = useRef(new Map())

  const handleDeleteBot = async (id) => {
    deletedIds.current.set(id, Date.now() + 5 * 60 * 1000)
    setBots(prev => prev.filter(b => b.id !== id))
    if (supabase) {
      try {
        const r = await authFetch('/api/bots/delete', {
          method: 'POST',
          body: JSON.stringify({ id }),
        })
        if (!r.ok) throw new Error(`delete ${r.status}`)
      } catch (e) {
        alert(`Could not delete bot from server: ${e?.message || e}\n\nThe bot may still be running on the server. Refresh in a minute and try Delete again.`)
        deletedIds.current.delete(id)
      }
    }
  }

  // Sends a market SELL for the bot's open position. Resolves to the
  // new bot state (with the trade moved to closedTrades) or throws on
  // API/auth error. Uses the bot's own testnet flag — backwards-compat
  // default is true for old bots that don't have it.
  const handleCloseBotPosition = async (id) => {
    const bot = botsRef.current.find(b => b.id === id)
    if (!bot || !bot.state.openPosition) return null
    const useTestnet = bot.config.testnet !== false
    const newState = await closeOpenPosition(
      bot.state,
      bot.config.pair,
      useTestnet,
      'manual'
    )
    setBots(prev => prev.map(b =>
      b.id === id ? { ...b, state: { ...newState, candles: b.state.candles } } : b
    ))
    return newState
  }

  // Multi-bot streaming + polling ----------------------------------

  const botsRef = useRef(bots)
  useEffect(() => { botsRef.current = bots }, [bots])

  // Stable key per running-bot config so the effect only re-runs on
  // structural changes (add/remove/pause/reconfig), not on every tick.
  const subscriptionKey = useMemo(() =>
    bots
      .filter(b => b.running)
      .map(b => [
        b.id, b.config.pair, b.config.source, b.config.interval,
        b.config.stratKey, JSON.stringify(b.config.params),
        b.config.direction, b.config.stopPct, b.config.takePct,
        b.config.stake, b.config.compound,
      ].join('|'))
      .sort()
      .join('||'),
    [bots]
  )

  useEffect(() => {
    let cancelled = false
    const disposers = []
    const lastTick = new Map() // botId → ms of last tick (for throttle)

    const intraday = (iv) => iv !== '1d'
    const candleFromRest = (row, iv) => {
      const iso = new Date(row.t).toISOString()
      return {
        f: intraday(iv) ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10),
        o: row.o, h: row.h, l: row.l, c: row.c, t: row.t,
      }
    }
    const candleFromWs = (live, iv) => {
      const iso = new Date(live.t).toISOString()
      return {
        f: intraday(iv) ? iso.slice(0, 16).replace('T', ' ') : iso.slice(0, 10),
        o: live.o, h: live.h, l: live.l, c: live.c, t: live.t,
      }
    }

    const runStrategyAndTick = async (botId, candles, signalEvaluation) => {
      const all = botsRef.current
      const bot = all.find(b => b.id === botId)
      if (!bot || !bot.running) return
      if (candles.length < 2) return
      const cfg = bot.config
      const last = candles[candles.length - 1]

      // Server-managed bots: the cron is authoritative for execution.
      // The browser only refreshes the candle buffer + live price so
      // the chart and floating P&L stay current; never call the
      // executor or emit notifications from here.
      if (bot.serverManaged !== false) {
        if (cancelled) return
        setBots(prev => prev.map(b =>
          b.id === botId
            ? {
                ...b,
                state: {
                  ...b.state,
                  candles: candles.slice(-300),
                  lastPrice: last.c,
                },
              }
            : b
        ))
        return
      }

      let signal = bot.state.openPosition?.side ?? 0
      if (signalEvaluation) {
        const Slive = STRATS[cfg.stratKey]
        const dir = Slive.supportsDirection ? cfg.direction : 'long'
        const { pos } = Slive.run(candles, cfg.params, dir)
        signal = pos[pos.length - 1] | 0
      }

      const opts = {
        stopPct: cfg.stopPct,
        takePct: cfg.takePct,
        compound: cfg.compound,
        fixedStake: cfg.stake,
        coin: cfg.pair,
        // Bots saved before this field existed default to testnet.
        testnet: cfg.testnet !== false,
      }
      let next
      try {
        next = await binanceTick(bot.state, signal, last.c, last, Date.now(), opts)
        // Diff against previous state to fire Telegram notifications.
        const prevHadOpen = !!bot.state.openPosition
        const nextHasOpen = !!next.openPosition
        const prevClosedCount = bot.state.closedTrades.length
        const nextClosedCount = next.closedTrades.length
        const networkTag = opts.testnet ? 'TESTNET' : '<b>MAINNET</b>'
        if (!prevHadOpen && nextHasOpen) {
          notify(`🟢 <b>Entry</b> · ${bot.name}\n${networkTag}\nBought ${next.openPosition.qty.toFixed(6)} ${cfg.pair} at ${next.openPosition.entryPrice.toFixed(2)} USDT`)
        }
        if (nextClosedCount > prevClosedCount) {
          const t = next.closedTrades[nextClosedCount - 1]
          const sign = t.pnlUSD >= 0 ? '+' : ''
          notify(`🔴 <b>Exit</b> · ${bot.name}\n${networkTag}\nSold at ${t.exitPrice.toFixed(2)} USDT (${t.reason})\nP&L: ${sign}${t.pnlUSD.toFixed(2)} USDT (${sign}${t.netPct.toFixed(2)}%)`)
        }
      } catch (e) {
        console.warn(`bot ${bot.name} executor error:`, e?.message || e)
        next = {
          ...bot.state,
          lastTickAt: Date.now(),
          lastPrice: last.c,
          lastError: String(e?.message || e),
        }
      }
      if (cancelled) return
      setBots(prev => prev.map(b =>
        b.id === botId
          ? { ...b, state: { ...next, candles: candles.slice(-300) } }
          : b
      ))
    }

    const backfill = async (bot) => {
      try {
        const r = await fetch(
          `/api/ohlc?coin=${bot.config.pair}&interval=${bot.config.interval}&_=${Date.now()}`,
          { cache: 'no-store' }
        )
        const data = await r.json()
        if (!r.ok || data.error || cancelled) return null
        return data.candles.map(row => candleFromRest(row, bot.config.interval))
      } catch { return null }
    }

    const setupStream = async (bot) => {
      const initial = await backfill(bot)
      if (cancelled || !initial) return

      // Seed the candle buffer immediately
      setBots(prev => prev.map(b =>
        b.id === bot.id
          ? { ...b, state: { ...b.state, candles: initial.slice(-300) } }
          : b
      ))

      const unsub = binanceStream.subscribe(bot.config.pair, bot.config.interval, (liveCandle) => {
        if (cancelled) return
        // Throttle non-close updates to ~500ms; always process candle closes
        const now = Date.now()
        const last = lastTick.get(bot.id) || 0
        if (!liveCandle.closed && now - last < 500) return
        lastTick.set(bot.id, now)

        const all = botsRef.current
        const b = all.find(x => x.id === bot.id)
        if (!b) return
        const buf = b.state.candles || []
        const c = candleFromWs(liveCandle, b.config.interval)
        let nextBuf
        if (buf.length === 0 || c.t > buf[buf.length - 1].t) {
          nextBuf = [...buf, c]
        } else if (c.t === buf[buf.length - 1].t) {
          nextBuf = [...buf.slice(0, -1), c]
        } else {
          return // older candle, ignore
        }
        runStrategyAndTick(bot.id, nextBuf, liveCandle.closed)
      })
      disposers.push(unsub)
    }

    const setupPoll = async (bot) => {
      const run = async () => {
        if (cancelled) return
        const initial = await backfill(bot)
        if (cancelled || !initial) return
        runStrategyAndTick(bot.id, initial, true)
      }
      run()
      const id = setInterval(run, POLL_MS)
      disposers.push(() => clearInterval(id))
    }

    for (const bot of botsRef.current) {
      if (!bot.running) continue
      // The browser still subscribes to the candle stream so charts and
      // floating P&L update live. For server-managed bots, runStrategyAndTick
      // short-circuits before placing any orders — the cron is the only
      // executor.
      if (bot.config.source === 'binance') setupStream(bot)
      else setupPoll(bot)
    }

    return () => {
      cancelled = true
      for (const d of disposers) {
        try { d() } catch {}
      }
    }
  }, [subscriptionKey])

  // Render ----------------------------------------------------------

  const [l1, l2] = S.leyenda(params)
  const rango = visibleCandles.length
    ? `${visibleCandles[0].f} – ${visibleCandles[visibleCandles.length - 1].f}`
    : '—'

  return (
    <>
      <div className="safebar">
        <span className="dot"></span>
        {(() => {
          const running = networkBots.filter(b => b.running).length
          if (running === 0) return <>No bots running on {networkView}</>
          return (
            <>
              {running} bot{running === 1 ? '' : 's'} running ({networkView})
              <button
                type="button"
                className="safebar-stop"
                onClick={handleEmergencyStop}
                title="Pause every running bot immediately (all networks)"
              >
                🛑 PAUSE ALL
              </button>
            </>
          )
        })()}
        <span className="safebar-pnl">
          today{' '}
          <span className={todayPnL > 0 ? 'pos' : todayPnL < 0 ? 'neg' : ''}>
            {todayPnL > 0 ? '▲ ' : todayPnL < 0 ? '▼ ' : ''}
            {signed(todayPnL)}
          </span>
          {dailyLossLimit > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>
              · limit −{dailyLossLimit}
            </span>
          )}
        </span>
        <span className="datasrc">{dataSrc}</span>
      </div>

      <div className="wrap">
        <header>
          <h1>Trend Bot</h1>
          <div className="header-right">
            <div className="header-controls">
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <div className="net-toggle">
                <button
                  type="button"
                  className={networkView === 'testnet' ? 'active' : ''}
                  onClick={() => setNetworkView('testnet')}
                >TESTNET</button>
                <button
                  type="button"
                  className={networkView === 'mainnet' ? 'active' : ''}
                  onClick={() => setNetworkView('mainnet')}
                >MAINNET</button>
              </div>
            </div>
            <div className="header-stats">
              <div className="hstat balance-cell">
                <div className="label">USDT balance ({networkView})</div>
                <div className="value">
                  {usdtBalance == null ? '—' : usdPrecise(usdtBalance)}
                </div>
                {allBalances.length > 0 && (
                  <div className="balance-pop" role="tooltip">
                    <div className="balance-pop-head">
                      All balances · {networkView}
                    </div>
                    <table className="balance-pop-table">
                      <tbody>
                        {allBalances
                          .slice()
                          .sort((a, b) => (b.total || 0) - (a.total || 0))
                          .map(b => (
                            <tr key={b.asset}>
                              <td>{b.asset}</td>
                              <td className="num">{(+b.total).toLocaleString('en-US', {
                                maximumFractionDigits: 8,
                                minimumFractionDigits: 2,
                              })}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="hstat">
                <div className="label">Unrealised P&amp;L</div>
                <div className={`value ${anyOpen ? (unrealisedPnL > 0 ? 'pos' : unrealisedPnL < 0 ? 'neg' : '') : 'mute'}`}>
                  {anyOpen
                    ? <>{unrealisedPnL > 0 ? '▲ ' : unrealisedPnL < 0 ? '▼ ' : ''}{signed(unrealisedPnL)}</>
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </header>

        <Tabs tab={tab} onChange={setTab} tradeCount={networkBots.length} />

        {tab === 'backtest' && (
          <>
            <Controls
              stratKey={stratKey}
              params={params}
              onStratChange={handleStratChange}
              onParamChange={handleParamChange}
              pair={pair}
              onPairChange={handlePairChange}
              interval={interval}
              onIntervalChange={handleIntervalChange}
              desde={desde}
              hasta={hasta}
              minDate={minDate}
              maxDate={maxDate}
              onDateChange={handleDateChange}
              stopPct={stopPct}
              takePct={takePct}
              onStopChange={v => { markStarted(); setStopPct(v) }}
              onTakeChange={v => { markStarted(); setTakePct(v) }}
              stake={stake}
              compound={compound}
              onStakeChange={v => { markStarted(); setStake(v) }}
              onCompoundChange={v => { markStarted(); setCompound(v) }}
              direction={direction}
              directionSupported={S.supportsDirection}
              onDirectionChange={v => { markStarted(); setDirection(v) }}
              loading={loading}
              pristine={!backtestStarted}
            />

            {backtestStarted ? (
              <>
            <div className="post-controls">
              <button
                type="button"
                className="btn"
                style={{ background: '#166534', borderColor: '#166534' }}
                onClick={() => setPendingCreate({ network: 'testnet' })}
                disabled={
                  !!paramError || !!rangeWarn ||
                  !executorSupportsCoin(coin.symbol) ||
                  effectiveDirection !== 'long'
                }
                title={
                  paramError || rangeWarn ? 'Fix the warnings first' :
                  !executorSupportsCoin(coin.symbol)
                    ? `${coin.symbol} is not available on Binance Spot`
                    : effectiveDirection !== 'long'
                      ? 'Binance Spot only supports long positions'
                      : 'Execute this strategy live against Binance Testnet (fake money)'
                }
              >
                + Create Testnet bot
              </button>
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 8 }}
                onClick={() => setPendingCreate({ network: 'mainnet' })}
                disabled={
                  !!paramError || !!rangeWarn ||
                  !executorSupportsCoin(coin.symbol) ||
                  effectiveDirection !== 'long'
                }
                title="Execute this strategy live against Binance MAINNET — REAL MONEY"
              >
                + Create MAINNET bot
              </button>
              <span style={{ color: 'var(--mute)', fontSize: 13, marginLeft: 12 }}>
                Will be named: <b>{currentConfigLabel}</b>
              </span>
            </div>

            {paramError && <div className="warn">{paramError}</div>}
            {rangeWarn && <div className="warn">{rangeWarn}</div>}
            {loadError && <div className="warn">{loadError}</div>}

            {result && <KPIs met={result.met} stake={stake} />}

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
                  symbol={coin.symbol}
                />
              )}
            </section>

            <section className="chartblock">
              <div className="chead">
                <div className="label">
                  Your money over time · {stake.toLocaleString('en-US')} USDT invested
                  {!compound && <span style={{ color: 'var(--mute)', fontWeight: 400 }}> · fixed size per trade</span>}
                </div>
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
                  stake={stake}
                />
              )}
            </section>

            {result && <TradeTable trades={result.trades} symbol={coin.symbol} />}
              </>
            ) : (
              <div className="backtest-empty">
                <div className="backtest-empty-title">Configure a strategy to start</div>
                <div className="backtest-empty-text">
                  Pick a coin, timeframe, strategy and parameters above —
                  results appear automatically as you change them.
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'bots' && (
          <TradesView
            bots={networkBots}
            allBotsCount={bots.length}
            networkView={networkView}
            networkTrades={allTrades.filter(t =>
              (t.testnet !== false) === (networkView === 'testnet')
            )}
            onToggleBot={handleToggleBot}
            onDeleteBot={handleDeleteBot}
            onCloseBotPosition={handleCloseBotPosition}
            reconciliationWarnings={reconciliationWarnings}
          />
        )}

        {tab === 'account' && (
          <AccountView
            networkView={networkView}
            dailyLossLimit={dailyLossLimit}
            onDailyLossLimitChange={setDailyLossLimit}
          />
        )}

      </div>

      {pendingCreate && (
        <CreateBotConfirm
          network={pendingCreate.network}
          coinSymbol={coin.symbol}
          stratName={S.nombre}
          interval={interval}
          direction={effectiveDirection}
          stake={stake}
          compound={compound}
          stopPct={stopPct}
          takePct={takePct}
          existingCommitment={bots
            .filter(b => b.running && (b.config.testnet !== false) === (pendingCreate.network === 'testnet'))
            .reduce((sum, b) => sum + (+b.config.stake || 0), 0)}
          runningBotCount={bots.filter(b => b.running && (b.config.testnet !== false) === (pendingCreate.network === 'testnet')).length}
          onCancel={() => setPendingCreate(null)}
          onConfirm={() => {
            const net = pendingCreate.network
            setPendingCreate(null)
            handleCreateBot(net)
          }}
        />
      )}
    </>
  )
}

function CreateBotConfirm({
  network, coinSymbol, stratName, interval, direction,
  stake, compound, stopPct, takePct,
  existingCommitment, runningBotCount,
  onConfirm, onCancel,
}) {
  const isMainnet = network === 'mainnet'
  // balance: null = loading, false = no key / error, number = USDT total
  const [balance, setBalance] = useState(null)
  const [balanceError, setBalanceError] = useState('')
  useEffect(() => {
    let cancelled = false
    const flag = isMainnet ? 0 : 1
    ;(async () => {
      try {
        const r = await authFetch(`/api/binance/balance?testnet=${flag}`)
        const data = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) {
          setBalance(false)
          setBalanceError(data?.error || `HTTP ${r.status}`)
          return
        }
        const usdt = (data.balances || []).find(b => b.asset === 'USDT')
        setBalance(usdt ? usdt.total : 0)
      } catch (e) {
        if (!cancelled) {
          setBalance(false)
          setBalanceError(String(e?.message || e))
        }
      }
    })()
    return () => { cancelled = true }
  }, [isMainnet])
  const projected = (existingCommitment || 0) + (+stake || 0)
  const overBudget = typeof balance === 'number' && projected > balance
  const shortfall = overBudget ? projected - balance : 0
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal create-confirm" onClick={e => e.stopPropagation()}>
        <div className={`create-confirm-banner ${isMainnet ? 'mainnet' : 'testnet'}`}>
          {isMainnet ? 'MAINNET — REAL MONEY' : 'TESTNET — DEMO MONEY'}
        </div>
        <h3 className="modal-title" style={{ marginTop: 0 }}>
          Create {isMainnet ? 'mainnet' : 'testnet'} bot on {coinSymbol}/USDT?
        </h3>
        <div className="modal-body">
          <table className="create-confirm-table">
            <tbody>
              <tr><td>Strategy</td><td>{stratName}</td></tr>
              <tr><td>Direction</td><td style={{ textTransform: 'capitalize' }}>{direction}</td></tr>
              <tr><td>Timeframe</td><td>{interval}</td></tr>
              <tr>
                <td>Investment</td>
                <td><b>{stake.toLocaleString('en-US')} USDT</b></td>
              </tr>
              <tr>
                <td>Stop loss</td>
                <td>{stopPct > 0 ? `${stopPct}%` : 'off'}</td>
              </tr>
              <tr>
                <td>Take profit</td>
                <td>{takePct > 0 ? `${takePct}%` : 'off'}</td>
              </tr>
              <tr>
                <td>Reinvest profits</td>
                <td>{compound ? 'Compounding' : 'Fixed size'}</td>
              </tr>
            </tbody>
          </table>

          <div className="create-confirm-budget">
            <div className="label" style={{ marginBottom: 6 }}>
              {isMainnet ? 'Mainnet' : 'Testnet'} USDT budget
            </div>
            <table className="create-confirm-table" style={{ fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>Wallet USDT</td>
                  <td>
                    {balance === null && <span style={{ color: 'var(--mute)' }}>checking…</span>}
                    {balance === false && <span style={{ color: 'var(--mute)' }}>—</span>}
                    {typeof balance === 'number' && usdPrecise(balance)}
                  </td>
                </tr>
                <tr>
                  <td>Already committed ({runningBotCount} bot{runningBotCount === 1 ? '' : 's'})</td>
                  <td>{usdPrecise(existingCommitment || 0)}</td>
                </tr>
                <tr>
                  <td>This bot</td>
                  <td>{usdPrecise(+stake || 0)}</td>
                </tr>
                <tr>
                  <td><b>Total after creation</b></td>
                  <td className={overBudget ? 'neg' : ''}>
                    <b>{usdPrecise(projected)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
            {balance === false && (
              <p className="create-confirm-info">
                Couldn't read the {isMainnet ? 'mainnet' : 'testnet'} balance ({balanceError || 'no API key'}).
                Creating the bot anyway is fine — it'll show the error on its card if the wallet is short.
              </p>
            )}
            {overBudget && (
              <p className="create-confirm-warn">
                <b>Over budget by {usdPrecise(shortfall)}.</b>{' '}
                The combined investment of all your running {isMainnet ? 'mainnet' : 'testnet'} bots will exceed your USDT balance.
                When this bot tries to enter a position it'll fail with <i>insufficient balance</i> until you top up or pause another bot.
              </p>
            )}
          </div>

          {isMainnet && (
            <p className="create-confirm-warn">
              This bot will place <b>real orders</b> on Binance.com using your mainnet API key.
              Losses are real and not recoverable.
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            style={isMainnet
              ? { background: 'var(--neg)', borderColor: 'var(--neg)' }
              : { background: '#166534', borderColor: '#166534' }}
          >
            {isMainnet ? 'Confirm — create MAINNET bot' : 'Create testnet bot'}
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_CANDLES } from './lib/demoData.js'
import { STRATS } from './lib/strategies.js'
import { backtest } from './lib/backtest.js'
import { coinByPair } from './lib/coins.js'
import { createInitialState, tick as paperTick } from './lib/paperTrader.js'
import { executeTick as binanceTick, executorSupportsCoin } from './lib/binanceExecutor.js'
import { binanceStream } from './lib/binanceStream.js'
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
    return raw ? JSON.parse(raw) : []
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
  const [tab, setTab] = useState('backtest')

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

  const handleStratChange = key => {
    setStratKey(key)
    setParams(defaultParams(key))
  }
  const handleParamChange = (k, v) => {
    setParams(prev => ({ ...prev, [k]: v }))
  }
  const handleDateChange = (which, value) => {
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
    setIntervalState(iv)
    cargarOhlc(iv, pair)
  }
  const handlePairChange = (pr) => {
    setPair(pr)
    cargarOhlc(interval, pr)
  }

  useEffect(() => {
    cargarOhlc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bot management --------------------------------------------------

  const currentConfigLabel = `${coin.symbol} · ${S.nombre} · ${effectiveDirection}`

  const handleCreateBot = (executor = 'paper') => {
    const id = newId()
    const baseName = currentConfigLabel + (executor === 'binance-testnet' ? ' · LIVE' : '')
    const sameNameCount = bots.filter(b => b.name.startsWith(baseName)).length
    const name = sameNameCount > 0 ? `${baseName} #${sameNameCount + 1}` : baseName
    const bot = {
      id,
      name,
      createdAt: Date.now(),
      running: true,
      config: {
        pair, source: 'binance', interval,
        stratKey,
        params: { ...params },
        direction,
        effectiveDirection,
        stopPct, takePct,
        stake, compound,
        executor,
      },
      state: createInitialState(stake),
    }
    setBots(prev => [...prev, bot])
    setTab('trades')
  }
  const handleToggleBot = (id) => {
    setBots(prev => prev.map(b => b.id === id ? { ...b, running: !b.running } : b))
  }
  const handleDeleteBot = (id) => {
    setBots(prev => prev.filter(b => b.id !== id))
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

      let signal = bot.state.openPosition?.side ?? 0
      if (signalEvaluation) {
        const Slive = STRATS[cfg.stratKey]
        const dir = Slive.supportsDirection ? cfg.direction : 'long'
        const { pos } = Slive.run(candles, cfg.params, dir)
        signal = pos[pos.length - 1] | 0
      }

      const last = candles[candles.length - 1]
      const opts = {
        stopPct: cfg.stopPct,
        takePct: cfg.takePct,
        compound: cfg.compound,
        fixedStake: cfg.stake,
        coin: cfg.pair,
        testnet: true,
      }
      let next
      try {
        if (cfg.executor === 'binance-testnet') {
          next = await binanceTick(bot.state, signal, last.c, last, Date.now(), opts)
        } else {
          next = paperTick(bot.state, signal, last.c, last, Date.now(), opts)
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
        Safe mode · the bot does not place real orders
        <span className="datasrc">{dataSrc}</span>
      </div>

      <div className="wrap">
        <header>
          <h1>Trend Bot <span>/ {coin.symbol}/USD</span></h1>
          <div className="meta">
            <div>{rango}</div>
            <div>{updatedAt || '—'}</div>
          </div>
        </header>

        <Tabs tab={tab} onChange={setTab} tradeCount={bots.length} />

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
              onStopChange={setStopPct}
              onTakeChange={setTakePct}
              stake={stake}
              compound={compound}
              onStakeChange={setStake}
              onCompoundChange={setCompound}
              direction={direction}
              directionSupported={S.supportsDirection}
              onDirectionChange={setDirection}
              loading={loading}
            />

            <div className="post-controls">
              <button
                type="button"
                className="btn"
                onClick={() => handleCreateBot('paper')}
                disabled={!!paramError || !!rangeWarn}
                title={(paramError || rangeWarn) ? 'Fix the warnings before saving' : 'Save this config as a paper bot'}
              >
                + Save as paper bot
              </button>
              <button
                type="button"
                className="btn"
                style={{ marginLeft: 8, background: '#166534', borderColor: '#166534' }}
                onClick={() => handleCreateBot('binance-testnet')}
                disabled={
                  !!paramError || !!rangeWarn ||
                  !executorSupportsCoin(coin.symbol) ||
                  effectiveDirection !== 'long'
                }
                title={
                  !executorSupportsCoin(coin.symbol)
                    ? 'This coin is not available on Binance Spot Testnet'
                    : effectiveDirection !== 'long'
                      ? 'Binance Spot Testnet only supports long positions'
                      : 'Save this config as a LIVE Testnet bot — executes real orders on Binance Testnet'
                }
              >
                + Save as Testnet bot
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
        )}

        {tab === 'trades' && (
          <TradesView
            bots={bots}
            onToggleBot={handleToggleBot}
            onDeleteBot={handleDeleteBot}
            onCreateBot={handleCreateBot}
            currentConfigLabel={currentConfigLabel}
          />
        )}

        {tab === 'account' && <AccountView />}

        <footer>
          Research tool, not financial advice. Demo figures do not predict future performance.
          Correct order: backtest → paper trading → real capital, and start small.
        </footer>
      </div>
    </>
  )
}

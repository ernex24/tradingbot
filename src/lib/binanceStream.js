// Browser-side WebSocket manager for Binance kline (candle) streams.
// Multiple subscribers to the same (symbol, interval) share a single WS.
// Auto-reconnects on disconnect.

const BINANCE_SYMBOLS = {
  BTC: 'btcusdt',
  ETH: 'ethusdt',
  SOL: 'solusdt',
  SUI: 'suiusdt',
}

class BinanceStreamManager {
  constructor() {
    this.streams = new Map() // key: "btcusdt:1m" → { ws, listeners: Set, lastCandle }
  }

  subscribe(coin, interval, listener) {
    const symbol = BINANCE_SYMBOLS[coin]
    if (!symbol) return () => {}
    const key = `${symbol}:${interval}`
    let stream = this.streams.get(key)
    if (!stream) {
      stream = { ws: null, listeners: new Set(), lastCandle: null, key, symbol, interval, retryDelay: 1000 }
      this.streams.set(key, stream)
      this._connect(stream)
    }
    stream.listeners.add(listener)
    if (stream.lastCandle) {
      try { listener(stream.lastCandle) } catch {}
    }
    return () => {
      stream.listeners.delete(listener)
      if (stream.listeners.size === 0) {
        try { stream.ws?.close() } catch {}
        this.streams.delete(key)
      }
    }
  }

  _connect(stream) {
    const url = `wss://stream.binance.com:9443/ws/${stream.symbol}@kline_${stream.interval}`
    try {
      const ws = new WebSocket(url)
      stream.ws = ws
      ws.onopen = () => { stream.retryDelay = 1000 }
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (!d.k) return
          const k = d.k
          const candle = {
            t: k.t,
            o: +k.o, h: +k.h, l: +k.l, c: +k.c,
            closed: !!k.x,
          }
          stream.lastCandle = candle
          for (const l of stream.listeners) {
            try { l(candle) } catch {}
          }
        } catch {}
      }
      ws.onerror = () => { /* let onclose handle reconnect */ }
      ws.onclose = () => {
        if (stream.listeners.size === 0) return
        const delay = Math.min(stream.retryDelay, 30000)
        stream.retryDelay = Math.min(stream.retryDelay * 2, 30000)
        setTimeout(() => {
          if (stream.listeners.size > 0) this._connect(stream)
        }, delay)
      }
    } catch (e) {
      console.warn('binance ws failed:', e)
    }
  }
}

export const binanceStream = new BinanceStreamManager()

import { useEffect, useState } from 'react'

// Minimal hash-free URL state. Maps:
//   /         → backtest
//   /bots     → bots (was /trades)
//   /account  → account
//
// Old /trades links still resolve to the bots tab for backwards compat.
const PATH_TO_TAB = {
  '/': 'backtest',
  '/bots': 'bots',
  '/trades': 'bots',
  '/account': 'account',
}
const TAB_TO_PATH = {
  backtest: '/',
  bots: '/bots',
  account: '/account',
}

export function pathToTab(path) {
  return PATH_TO_TAB[path] || 'backtest'
}
export function tabToPath(tab) {
  return TAB_TO_PATH[tab] || '/'
}

export function usePath() {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname
  )
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (newPath) => {
    if (newPath === window.location.pathname) return
    window.history.pushState({}, '', newPath)
    setPath(newPath)
  }
  return [path, navigate]
}

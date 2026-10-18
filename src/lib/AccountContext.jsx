// src/lib/AccountContext.jsx
//
// Who is signed in to the Print Octos app.
//
// Accounts live in the app only: the website stays without them, as it
// is. The session token the server gave is kept in the app's own private
// storage on the phone (no other app can read it) and sent with every
// request, so a customer signs in once per phone.
//
// The server is the authority: on start the token is checked with it,
// and one it no longer honours (signed out elsewhere, account deleted)
// is quietly forgotten.
//
// Preferences is imported directly, never returned from an async
// function: Capacitor plugins answer every property, `then` included,
// so returning one from a promise makes JavaScript call a `then` method
// that does not exist, and the whole sign-in check fails.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import { accountMe, accountSignOut, setAppToken } from '../api/client'

const AccountContext = createContext(null)
const KEY = 'print-octos.session'

// In the phone app, or in a preview on the developer's own machine
// opened once with ?app in the address (never in a published build).
export const inApp = () => {
  if (window.Capacitor?.isNativePlatform?.()) return true
  if (!import.meta.env.DEV) return false
  if (new URLSearchParams(window.location.search).has('app')) sessionStorage.setItem('pretend-app', '1')
  return sessionStorage.getItem('pretend-app') === '1'
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [ready, setReady] = useState(!inApp())

  useEffect(() => {
    if (!inApp()) return undefined
    let live = true
    ;(async () => {
      try {
        const { value } = await Preferences.get({ key: KEY })
        if (value) {
          setAppToken(value)
          const { data } = await accountMe()
          if (live) setAccount(data)
        }
      } catch {
        // A token the server no longer honours, or storage that failed:
        // either way, start signed out.
        setAppToken(null)
        try { await Preferences.remove({ key: KEY }) } catch { /* nothing to remove */ }
      } finally {
        if (live) setReady(true)
      }
    })()
    return () => { live = false }
  }, [])

  const signedIn = useCallback(async (token, details) => {
    setAppToken(token)
    await Preferences.set({ key: KEY, value: token })
    setAccount(details)
  }, [])

  const signOut = useCallback(async () => {
    try { await accountSignOut() } catch { /* ended either way */ }
    setAppToken(null)
    try { await Preferences.remove({ key: KEY }) } catch { /* already gone */ }
    setAccount(null)
  }, [])

  return (
    <AccountContext.Provider value={{ account, ready, signedIn, signOut, inApp: inApp() }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const value = useContext(AccountContext)
  if (!value) throw new Error('useAccount must be used inside an AccountProvider')
  return value
}
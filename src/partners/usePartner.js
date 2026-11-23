// src/partners/usePartner.js
//
// The signed-in partner, from the server: who they are, their status, and
// once approved, their dashboard. A token the server no longer honours is
// forgotten; a number with no partner account says so.

import { useCallback, useEffect, useState } from 'react'
import { partnerMe, saveToken, savedToken, signOut } from './api'

export default function usePartner() {
  const [state, setState] = useState(() => ({ loading: !!savedToken(), partner: null, error: '' }))

  const load = useCallback(async () => {
    try {
      const { data } = await partnerMe()
      setState({ loading: false, partner: data, error: '' })
    } catch (e) {
      if (e?.response?.status === 401) saveToken('')
      setState({ loading: false, partner: null, error: e?.response?.status === 404 ? 'not-partner' : '' })
    }
  }, [])

  useEffect(() => {
    if (savedToken()) load()
  }, [load])

  const out = async () => {
    await signOut()
    saveToken('')
    setState({ loading: false, partner: null, error: '' })
  }
  return { ...state, reload: load, signOut: out }
}

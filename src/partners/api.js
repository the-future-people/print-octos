// src/partners/api.js
//
// Farhat Trade Partners (23 Nov 2026). Partners sign in on the website as
// well as in the app (they work at a shop computer), so their session is
// kept here, apart from the storefront's own calls, which stay without a
// login by design. The token lives in this browser only.

import axios from 'axios'
import client from '../api/client'

const KEY = 'farhat.partner.session'

export const partnerClient = axios.create({ baseURL: client.defaults.baseURL })

export function savedToken() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}

export function saveToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch { /* private window: signed in for this visit only */ }
  if (token) partnerClient.defaults.headers.common.Authorization = `App ${token}`
  else delete partnerClient.defaults.headers.common.Authorization
}

saveToken(savedToken())

export const signInCode = phone => partnerClient.post('/api/v1/storefront/account/code/', { phone })
export const signInVerify = (phone, code) =>
  partnerClient.post('/api/v1/storefront/account/verify/', { phone, code, device: 'partners-web' })
export const signOut = () => partnerClient.post('/api/v1/storefront/account/signout/').catch(() => null)

export const partnerMe = () => partnerClient.get('/api/v1/partners/me/')
export const partnersOpen = invite => partnerClient.get('/api/v1/partners/open/', { params: { invite } })
export const applyCode = (phone, invite) => partnerClient.post('/api/v1/partners/code/', { phone, invite })
export const apply = form => partnerClient.post('/api/v1/partners/apply/', form)
export const startPartnerOrder = reference => partnerClient.post('/api/v1/partners/orders/', { reference })

// A readable message from any refusal the server sends.
export function problem(error, fallback = 'Something went wrong. Try again.') {
  const data = error?.response?.data
  if (typeof data?.detail === 'string') return data.detail
  return fallback
}

export const money = value => `GHS ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

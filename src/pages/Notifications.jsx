// src/pages/Notifications.jsx
//
// Everything Print Octos has told the customer, newest first. Opening
// the screen marks them read; tapping one opens its order.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { accountNotifications, accountNotificationsRead } from '../api/client'
import { useAccount } from '../lib/AccountContext.jsx'
import Header from '../components/Header.jsx'

const TONE = {
  paid: 'bg-farhat/10 text-farhat',
  ready: 'bg-emerald-100 text-emerald-700',
}

function when(iso) {
  const at = new Date(iso)
  const today = new Date().toDateString() === at.toDateString()
  const time = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  return today ? time : `${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`
}

export default function Notifications() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { account, ready } = useAccount()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => accountNotifications().then(r => r.data),
    enabled: !!account,
  })

  // Seen is read: the bell clears once they have looked.
  useEffect(() => {
    if (!data?.unread) return
    accountNotificationsRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch(() => {})
  }, [data?.unread, queryClient])

  const items = data?.items || []

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-4 pb-6">
        {ready && !account && (
          <div className="py-16 text-center">
            <p className="text-lg font-bold">Sign in to see your notifications</p>
            <button onClick={() => navigate('/account?next=/notifications')}
                    className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm font-semibold">
              Sign in
            </button>
          </div>
        )}

        {account && isLoading && <p className="py-10 text-sm text-body">Loading…</p>}

        {account && !isLoading && items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-base font-semibold">Nothing yet</p>
            <p className="mt-1 text-sm text-body">
              We’ll tell you here when your payment lands and when your order is ready.
            </p>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {items.map(n => (
            <button key={n.id}
                    onClick={() => n.order_number && navigate(`/track/${n.order_number}?t=${n.token}`)}
                    className={`w-full text-left flex gap-3 p-3.5 rounded-2xl border
                                ${n.read ? 'border-rule bg-white' : 'border-farhat/30 bg-farhat/[0.03]'}`}>
              <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${TONE[n.kind] || 'bg-substrate text-body'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden="true">
                  {n.kind === 'ready'
                    ? <path d="M5 12.5l4.5 4.5L19 7" />
                    : <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>}
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold truncate">{n.title}</span>
                  <span className="text-[0.7rem] text-body shrink-0">{when(n.at)}</span>
                </span>
                <span className="block mt-0.5 text-xs leading-relaxed text-body">{n.body}</span>
              </span>
              {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-farhat shrink-0" aria-label="Unread" />}
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
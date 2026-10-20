// src/pages/Notifications.jsx
//
// What Print Octos has told the customer, one card per order.
//
// "Payment received" and "Ready to collect" are two chapters of one
// order's story, so they live on one card: the latest news is the
// headline and sets the card's colour (green when it is ready, red while
// it is being made), the product sits inside it, and the updates run
// beneath as a thread, newest first. Messages that belong to no order
// stand on their own. Opening the screen marks everything read.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { accountNotifications, accountNotificationsRead } from '../api/client'
import { useAccount } from '../lib/AccountContext.jsx'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'
import ProductBadge from '../components/ProductBadge.jsx'

const LOOK = {
  ready: { card: 'bg-[#ecf9f1] border-[#c9ecd6]', icon: 'bg-green-600', title: 'text-[#0d5c33]', dot: 'bg-green-600' },
  paid: { card: 'bg-[#fdf1f1] border-[#f6d4d4]', icon: 'bg-farhat', title: 'text-ink', dot: 'bg-farhat' },
  other: { card: 'bg-[#eef4fd] border-[#d3e2f8]', icon: 'bg-blue-600', title: 'text-ink', dot: 'bg-blue-600' },
}
const lookOf = kind => LOOK[kind] || LOOK.other

const ICON = {
  ready: <path d="M5 12.5l4.5 4.5L19 7" />,
  paid: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  other: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4l3 2" /></>,
}

const METHOD = { mobile_money: 'Mobile money', card: 'Card', bank: 'Bank transfer', bank_transfer: 'Bank transfer', ussd: 'USSD' }

const time = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })

function dayOf(iso) {
  const at = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (at.toDateString() === today.toDateString()) return 'Today'
  if (at.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

// One card per order, newest news first; a message with no order is a
// card of its own.
function groupByOrder(items) {
  const groups = []
  const byOrder = {}
  for (const n of items) {
    const key = n.order_number || `note-${n.id}`
    if (!byOrder[key]) {
      byOrder[key] = { key, latest: n, notes: [] }
      groups.push(byOrder[key])
    }
    byOrder[key].notes.push(n)
  }
  return groups
}

function Product({ p, onOpen }) {
  if (!p) return null
  const photo = serviceImage(p.base_name || p.name)
  return (
    <button onClick={onOpen}
            className="w-[calc(100%-56px)] ml-[56px] mr-3 mb-2.5 flex items-center gap-2.5 p-2 rounded-xl
                       bg-white/75 text-left">
      {photo ? (
        <img src={photo} alt="" className="w-10 h-10 rounded-[10px] object-cover shrink-0" />
      ) : (
        <span className="w-10 h-10 rounded-[10px] bg-[#fdecec] grid place-items-center shrink-0">
          <ProductBadge name={p.base_name || p.name} onLight />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold truncate">{p.name}</span>
        <span className="block text-[0.68rem] text-body">{p.detail}{p.more ? ` · and ${p.more} more` : ''}</span>
        {p.addons?.length > 0 && (
          <span className="block text-[0.68rem] text-body truncate">+ {p.addons.join(', ')}</span>
        )}
      </span>
      <span className="text-body/60 shrink-0" aria-hidden="true">›</span>
    </button>
  )
}

function PaymentBox({ n }) {
  return (
    <div className="mt-1.5 grid grid-cols-2 rounded-[10px] bg-white px-2.5 py-1.5">
      <div>
        <p className="text-[0.6rem] text-body">Amount paid</p>
        <p className="text-xs font-extrabold tabular-nums">GHS {n.total}</p>
      </div>
      <div className="pl-2.5 border-l border-[#f0ede8]">
        <p className="text-[0.6rem] text-body">Method</p>
        <p className="text-xs font-extrabold">{METHOD[n.payment_channel] || 'Paid online'}</p>
      </div>
    </div>
  )
}

function OrderCard({ g, startOpen, navigate }) {
  const [open, setOpen] = useState(startOpen)
  const n = g.latest
  const look = lookOf(n.kind)
  const unread = g.notes.some(x => !x.read)
  const openOrder = () => n.order_number && navigate(`/track/${n.order_number}?t=${n.token}`)
  const showThread = g.notes.length > 1 || g.notes.some(x => x.kind === 'paid' && x.total)

  return (
    <div className={`rounded-2xl border overflow-hidden ${look.card}`}>
      <div className="flex gap-3 px-3 pt-3 pb-2.5">
        <span className={`w-10 h-10 rounded-full grid place-items-center shrink-0 text-white ${look.icon}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
            {ICON[n.kind] || ICON.other}
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm font-extrabold ${look.title}`}>
              {n.title}
              {unread && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-farhat align-[1px]" aria-label="Unread" />}
            </p>
            <span className="text-[0.66rem] text-body shrink-0">{time(n.at)}</span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-ink/70">{n.body}</p>
        </div>
      </div>

      <Product p={n.product} onOpen={openOrder} />

      {showThread && open && (
        <div className="relative border-t border-black/5 bg-white/55 pl-[56px] pr-3 pt-2 pb-1">
          {g.notes.length > 1 && <span className="absolute left-[39px] top-4 bottom-5 w-0.5 bg-[#e1ddd5]" />}
          {g.notes.map(x => (
            <div key={x.id} className="relative pb-2">
              {g.notes.length > 1 && (
                <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full ${lookOf(x.kind).dot}`} />
              )}
              {g.notes.length > 1 && (
                <>
                  <p className="text-[0.72rem] font-bold">{x.title}</p>
                  <p className="text-[0.66rem] text-body">{time(x.at)}</p>
                </>
              )}
              {x.kind === 'paid' && x.total && <PaymentBox n={x} />}
            </div>
          ))}
        </div>
      )}

      {n.order_number && (
        <div className="flex items-center justify-between border-t border-black/5 px-3 py-2 text-[0.7rem] font-bold">
          <button onClick={() => showThread && setOpen(o => !o)} className="text-ink/60">
            {g.notes.length} update{g.notes.length === 1 ? '' : 's'}
            {showThread && <span className="ml-1">{open ? '▴' : '▾'}</span>}
          </button>
          <button onClick={openOrder} className="text-farhat">View order ›</button>
        </div>
      )}
    </div>
  )
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

  const groups = groupByOrder(data?.items || [])
  const days = []
  for (const g of groups) {
    const d = dayOf(g.latest.at)
    const last = days[days.length - 1]
    if (last && last.day === d) last.groups.push(g)
    else days.push({ day: d, groups: [g] })
  }

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header subtitle="Stay updated on your orders and account." />
      <main className="max-w-md mx-auto px-3 pb-8">
        {ready && !account && (
          <div className="py-16 text-center">
            <p className="text-lg font-bold">Sign in to see your notifications</p>
            <button onClick={() => navigate('/account?next=/notifications')}
                    className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm font-semibold">
              Sign in
            </button>
          </div>
        )}

        {account && isLoading && <p className="py-10 px-1 text-sm text-body">Loading…</p>}

        {account && !isLoading && groups.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-base font-semibold">Nothing yet</p>
            <p className="mt-1 text-sm text-body">
              We’ll tell you here when your payment lands and when your order is ready.
            </p>
          </div>
        )}

        {days.map(({ day, groups: list }, di) => (
          <section key={day}>
            <h2 className="mx-1 mt-1 mb-2 text-xs font-extrabold uppercase tracking-wider text-body">{day}</h2>
            <div className="space-y-2.5 mb-4">
              {list.map((g, gi) => (
                <OrderCard key={g.key} g={g} navigate={navigate}
                           startOpen={(di === 0 && gi === 0) || g.notes.some(x => !x.read)} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
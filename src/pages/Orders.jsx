// src/pages/Orders.jsx
//
// The Orders tab: every paid order on the customer's number, grouped by
// what they need to do. Ready to collect first (go and get it), then
// being made (wait), then collected (history). Rows are quiet; tapping
// one opens it in place, easing down, to show its lines and prices,
// where it has got to, and the one action that matters. Red is kept for
// that action, so the page is not a wall of it.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { accountOrders } from '../api/client'
import { useAccount } from '../lib/AccountContext.jsx'
import Header from '../components/Header.jsx'
import ProductBadge from '../components/ProductBadge.jsx'

const BRANCH_PHONE = '0556244194'
const BRANCH_MAP = 'https://www.google.com/maps/search/?api=1&query=Farhat+Printing+Press+Westland+Accra'

const FILTERS = [['active', 'Active'], ['collected', 'Collected'], ['cancelled', 'Cancelled'], ['history', 'History']]
const MAKING = ['paid', 'inspecting', 'press', 'finishing']
const STAGE_WORD = { paid: 'being checked', inspecting: 'being checked', press: 'in press', finishing: 'finishing' }

const GROUPS = {
  ready: { title: 'Ready to collect', dot: 'bg-green-600', tile: 'bg-[#e3f6ea]' },
  making: { title: 'Being made', dot: 'bg-amber-500', tile: 'bg-[#fdf1dc]' },
  collected: { title: 'Collected', dot: 'bg-stone-400', tile: 'bg-[#f3f1ec]' },
  cancelled: { title: 'Cancelled', dot: 'bg-stone-400', tile: 'bg-[#f3f1ec]' },
}

const day = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const shortNumber = n => n.replace(/^ORD-\d{4}-/, 'ORD-')
const money = v => (Number(v) > 0 ? `GHS ${Number(v).toFixed(2)}` : 'Free')

function timeLeft(e) {
  if (!e) return null
  if (e.held_up) return 'a short delay'
  if (e.running_over) return 'taking a little longer'
  const m = Number(e.minutes_left) || 0
  if (m < 60) return `about ${m} min left`
  const h = Math.floor(m / 60)
  return `about ${h} hr${m % 60 ? ` ${m % 60} min` : ''} left`
}

function groupOf(o) {
  if (o.stage === 'ready') return 'ready'
  if (o.stage === 'collected') return 'collected'
  if (o.stage === 'cancelled') return 'cancelled'
  return 'making'
}

function subline(o) {
  const g = groupOf(o)
  if (g === 'making') return [o.detail, STAGE_WORD[o.stage], timeLeft(o.estimate)]
  if (g === 'collected') return [o.detail, o.collected_at && `collected ${day(o.collected_at)}`]
  if (g === 'cancelled') return [o.detail, 'cancelled']
  return [o.detail, shortNumber(o.order_number), day(o.paid_at)]
}

// [steps done, current step] on the little stepper.
const STEP = { paid: [0, 0], inspecting: [0, 0], press: [1, 1], finishing: [2, 2] }

function Stepper({ stage }) {
  const [done, current] = STEP[stage] || [0, 0]
  const labels = [stage === 'paid' || stage === 'inspecting' ? 'Checking' : 'Received', 'Printing', 'Finishing', 'Ready']
  return (
    <div className="flex mt-1.5 mb-1">
      {labels.map((label, i) => (
        <div key={label} className="relative flex-1 flex flex-col items-center">
          {i < labels.length - 1 && (
            <span className={`absolute top-[4px] left-1/2 w-full h-0.5 ${i < done ? 'bg-farhat' : 'bg-[#e5e2dc]'}`} />
          )}
          <span className={`relative z-[1] w-2.5 h-2.5 rounded-full border-2 ${
            i < done ? 'bg-farhat border-farhat'
              : i === current ? 'bg-white border-farhat ring-[3px] ring-farhat/15'
              : 'bg-white border-[#ddd]'}`} />
          <span className={`mt-1 text-[0.6rem] ${i <= current ? 'text-ink font-semibold' : 'text-body/70'}`}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function Item({ o, open, onToggle, navigate }) {
  const g = groupOf(o)
  const quiet = g === 'collected' || g === 'cancelled'
  const details = () => navigate(`/track/${o.order_number}?t=${o.token}`)

  return (
    <div className="border-b border-[#f0ede8] last:border-b-0">
      <button onClick={onToggle} aria-expanded={open}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-white">
        <span className={`w-[38px] h-[38px] rounded-[11px] grid place-items-center shrink-0 ${GROUPS[g].tile}`}>
          <ProductBadge name={o.base_name || o.summary} onLight />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[0.85rem] font-bold truncate ${quiet ? 'text-ink/65' : ''}`}>{o.summary}</span>
          <span className="block text-[0.7rem] text-body truncate mt-px">
            {subline(o).filter(Boolean).join(' · ')}
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round"
             className={`w-4 h-4 shrink-0 text-body/50 transition-transform duration-300 ${open ? 'rotate-90' : ''}`}
             aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* Opens by easing its height from nothing to its own. */}
      <div className={`grid transition-[grid-template-rows] duration-[350ms] ease-out
                       ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="pl-[61px] pr-3 pb-3 pt-0.5">
            {g === 'making' && <Stepper stage={o.stage} />}

            {(o.lines || []).map((line, i) => (
              <div key={i}>
                <div className="flex justify-between gap-3 py-1 text-[0.72rem]">
                  <span className="text-ink/80">{[line.name, line.detail].filter(Boolean).join(' · ')}</span>
                  <span className="shrink-0 tabular-nums">{line.total ? money(line.total) : ''}</span>
                </div>
                {(line.addons || []).map((a, j) => (
                  <p key={j} className="-mt-0.5 mb-0.5 ml-2 text-[0.66rem] text-body">
                    + {[a.name, a.detail].filter(Boolean).join(', ')} · {money(a.total)}
                  </p>
                ))}
              </div>
            ))}

            <div className="flex justify-between mt-1 pt-1.5 border-t border-dashed border-[#e5e2dc]
                            text-[0.75rem] font-extrabold">
              <span>Paid</span><span className="tabular-nums">GHS {o.total}</span>
            </div>

            <p className="mt-2 text-[0.68rem] text-body">
              {g === 'ready' && o.ready_since && `Ready since ${day(o.ready_since)} · `}
              {g === 'collected' && o.collected_at && `Collected ${day(o.collected_at)} · `}
              {o.branch || 'Westland Branch'} · {o.order_number}
            </p>

            <div className="mt-2.5 flex gap-1.5">
              {g === 'ready' && (
                <button onClick={() => window.open(BRANCH_MAP, '_blank')}
                        className="flex-1 py-2 rounded-[9px] bg-farhat text-white text-[0.7rem] font-bold">
                  Directions
                </button>
              )}
              <button onClick={details}
                      className="flex-1 py-2 rounded-[9px] border border-[#e3e0da] text-[0.7rem] font-bold text-ink">
                Full details
              </button>
              {g === 'making' && (
                <button onClick={() => { window.location.href = `tel:${BRANCH_PHONE}` }}
                        className="flex-1 py-2 rounded-[9px] border border-[#e3e0da] text-[0.7rem] font-bold text-ink">
                  Call us
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const navigate = useNavigate()
  const { account, ready } = useAccount()
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(() => new Set())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => accountOrders().then(r => r.data),
    enabled: !!account,
    refetchInterval: 60_000,
  })

  const active = data?.active || []
  const collected = data?.collected || []
  const cancelled = data?.cancelled || []
  // History is the complete record: every finished order, collected or
  // cancelled, newest first, as one chain grouped by month.
  const finishedAt = o => o.collected_at || o.paid_at
  const history = [...collected, ...cancelled].sort((a, b) => finishedAt(b).localeCompare(finishedAt(a)))
  const counts = { active: active.length, collected: collected.length,
                   cancelled: cancelled.length, history: history.length }

  const pool = filter === 'active' ? active : filter === 'collected' ? collected
    : filter === 'cancelled' ? cancelled : history
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = pool.filter(o => {
    const text = `${o.summary} ${o.order_number} ${o.detail}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
  const groups = filter === 'history' ? [] : ['ready', 'making', 'collected', 'cancelled']
    .map(g => [g, shown.filter(o => groupOf(o) === g)])
    .filter(([, list]) => list.length)
  const months = filter !== 'history' ? [] : Object.entries(shown.reduce((acc, o) => {
    const key = new Date(finishedAt(o)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    ;(acc[key] = acc[key] || []).push(o)
    return acc
  }, {}))

  const toggle = number => setOpen(prev => {
    const next = new Set(prev)
    next.has(number) ? next.delete(number) : next.add(number)
    return next
  })

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header subtitle={account ? 'Track and collect your printing jobs.' : null} />
      <main className="max-w-md mx-auto px-3 pb-6">
        {!ready ? null : !account ? (
          <div className="py-12 text-center px-2">
            <p className="text-lg font-bold">Your orders, all in one place</p>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              Sign in with your number to see what’s being made, what’s
              ready and everything you’ve collected.
            </p>
            <button onClick={() => navigate('/account?next=/orders')}
                    className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm font-semibold">
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 p-[3px] rounded-full bg-[#f3f1ec]" role="tablist">
              {FILTERS.map(([key, name]) => {
                const on = filter === key
                return (
                  <button key={key} role="tab" aria-selected={on} onClick={() => setFilter(key)}
                          className={`flex-1 py-1.5 rounded-full text-[0.7rem] font-semibold whitespace-nowrap
                                      ${on ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#666]'}`}>
                    {name}
                    <span className={`ml-1 text-[0.65rem] ${on ? 'text-farhat' : 'text-[#999]'}`}>{counts[key]}</span>
                  </button>
                )
              })}
            </div>

            <label className="mt-2.5 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#f3f1ec]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                   strokeLinecap="round" className="w-3.5 h-3.5 text-body shrink-0" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                     placeholder="Search your orders"
                     className="flex-1 min-w-0 bg-transparent text-[0.8rem] placeholder:text-body/70
                                focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear" className="text-body text-base leading-none">×</button>
              )}
            </label>

            {isLoading && <p className="mt-6 px-1 text-sm text-body">Loading your orders…</p>}
            {isError && <p className="mt-6 px-1 text-sm text-farhat">Your orders didn’t load. Try again in a moment.</p>}

            {!isLoading && !isError && groups.length === 0 && months.length === 0 && (
              <div className="mt-8 text-center">
                <p className="text-sm text-body">
                  {search ? 'No orders match that.'
                    : filter === 'cancelled' ? 'No cancelled orders.'
                    : filter === 'collected' ? 'Nothing collected yet.'
                    : filter === 'history' ? 'Your finished orders will build up here.'
                    : 'Nothing being made right now.'}
                </p>
                {!search && filter === 'active' && (
                  <button onClick={() => navigate('/')}
                          className="mt-3 px-4 py-2 rounded-lg bg-farhat text-white text-sm font-semibold">
                    Order something
                  </button>
                )}
              </div>
            )}

            {groups.map(([g, list]) => (
              <section key={g}>
                <h2 className="flex items-center gap-1.5 mt-4 mb-2 mx-1 text-[0.68rem] font-extrabold
                               tracking-[0.06em] uppercase text-[#777]">
                  <span className={`w-[7px] h-[7px] rounded-full ${GROUPS[g].dot}`} />
                  {GROUPS[g].title} · {list.length}
                </h2>
                <div className="rounded-2xl border border-[#ece9e3] overflow-hidden">
                  {list.map(o => (
                    <Item key={o.order_number} o={o} navigate={navigate}
                          open={open.has(o.order_number)} onToggle={() => toggle(o.order_number)} />
                  ))}
                </div>
              </section>
            ))}

            {months.map(([month, list]) => (
              <section key={month} className="mt-4">
                <h2 className="mx-1 mb-1 text-[0.68rem] font-extrabold tracking-[0.06em] uppercase text-[#777]">
                  {month}
                </h2>
                <ol className="relative ml-3">
                  {/* The chain: one line, a link for each finished order. */}
                  <span className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-[#ece9e3]" aria-hidden="true" />
                  {list.map(o => (
                    <li key={o.order_number} className="relative pl-6 py-1">
                      <span className={`absolute left-0 top-[22px] w-3 h-3 rounded-full border-2 border-white
                                        ${o.stage === 'cancelled' ? 'bg-stone-400' : 'bg-green-600'}`} />
                      <p className="text-[0.66rem] font-semibold text-body ml-1">
                        {day(finishedAt(o))} · {o.stage === 'cancelled' ? 'Cancelled' : 'Collected'}
                      </p>
                      <div className="mt-1 rounded-2xl border border-[#ece9e3] overflow-hidden">
                        <Item o={o} navigate={navigate}
                              open={open.has(o.order_number)} onToggle={() => toggle(o.order_number)} />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
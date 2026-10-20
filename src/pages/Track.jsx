import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrder, findOrder, accountOrders } from '../api/client'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'
import CollectionMap from '../components/CollectionMap.jsx'
import ProductBadge from '../components/ProductBadge.jsx'
import QRCode from 'react-qr-code'
import { useAccount } from '../lib/AccountContext.jsx'

/**
 * An order, as a record of it.
 *
 * Not a status page with the order attached — a record of what was
 * bought, what was paid, and where it is going, with the progress
 * alongside. That is what a customer opens this for: they know roughly
 * where it is, and they want to check what they ordered and when it
 * will be there.
 *
 * Reached from the link in the text message, which carries the order
 * number and its token. There are no accounts here, so the token is
 * what proves the order is yours — the number alone runs in sequence
 * and would let anyone read anyone's.
 *
 * The stages are the customer's words, not the floor's. Quality check
 * folds into finishing: naming it invites the question of what might
 * be wrong with theirs, and the answer is almost always nothing.
 */

const STAGES = [
  { key: 'paid', label: 'Paid' },
  { key: 'inspecting', label: 'Inspecting' },
  { key: 'press', label: 'In press' },
  { key: 'finishing', label: 'Finishing' },
  { key: 'ready', label: 'Ready to collect' },
]

export default function Track() {
  const { orderNumber } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const token = params.get('t')
  if (!orderNumber || !token) return <FindOrder navigate={navigate} />

  return <Record orderNumber={orderNumber} token={token} />
}

function Record({ orderNumber, token }) {
  const { inApp } = useAccount()
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['tracked-order', orderNumber],
    queryFn: () => getOrder(orderNumber, token).then(r => r.data),
    retry: false,
    // A customer watching this wants it to move on its own rather than
    // being told to refresh.
    // Every 15 seconds while the order is moving, a minute once it waits
    // on the shelf or has gone: a safety net under the silent nudges.
    // By moment, not by stage: a ready order is the one being collected
    // right now, with the customer at the counter, so it is watched every
    // few seconds; one being made, every 15; a collected one, not at all.
    refetchInterval: query => {
      const o = query.state.data
      if (!o) return 15_000
      if (o.handover_state === 'HANDED_OVER') return false
      if (o.work_state === 'DONE') return 3_000
      return 15_000
    },
  })

  useEffect(() => {
    document.title = `${orderNumber} — Farhat Printing Press`
  }, [orderNumber])

  if (isLoading) {
    return (
      <Shell orderNumber={orderNumber}>
        <p className="py-12 text-sm text-body">Looking up your order…</p>
      </Shell>
    )
  }

  if (isError || !order) {
    return (
      <Shell orderNumber={orderNumber}>
        <div className="py-12">
          <p className="text-base font-semibold">We can’t find that order</p>
          <p className="mt-1.5 text-sm leading-relaxed text-body">
            The link may have expired, or the order may have been cleared.
            Call us on{' '}
            <a href="tel:0300000000" className="font-semibold text-farhat">
              030 000 0000
            </a>{' '}
            with your order number and we’ll look it up.
          </p>
        </div>
      </Shell>
    )
  }

  // In the app, the same order as an app screen.
  if (inApp) return <AppTrack order={order} />

  const reached = STAGES.findIndex(s => s.key === stageOf(order))
  const lines = order.line_items || []
  const times = order.stage_times || {}

  return (
    <Shell orderNumber={order.order_number}>
      <div className="py-6 sm:py-8">

        <p className="text-xs text-body/70">
          Your order <span className="mx-1">›</span>
          <span className="text-body">{order.order_number}</span>
        </p>

        <div className="mt-2 sm:flex sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight
                           tabular-nums">
              {order.order_number}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-body">
              {order.paid_at && <>Ordered {dateLabel(order.paid_at)}</>}
              {order.promised_for && reached < STAGES.length - 1 && (
                <>
                  {order.paid_at && <span className="mx-1.5">·</span>}
                  <span className="font-semibold text-emerald-700">
                    Ready about {readyLabel(order.promised_for)}
                  </span>
                </>
              )}
              {reached === STAGES.length - 1 && (
                <>
                  {order.paid_at && <span className="mx-1.5">·</span>}
                  <span className="font-semibold text-emerald-700">
                    Ready to collect
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="mt-4 sm:mt-0 flex gap-2 shrink-0">
            {/* A receipt we do not generate yet. Shown because it is
                what a customer reaches for from a page like this, and
                saying "soon" beats pretending the need is not there. */}
            <button
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg
                         border border-rule text-xs font-semibold text-body/60
                         cursor-not-allowed"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                   className="w-4 h-4" aria-hidden="true">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                <path d="M9 8h6M9 12h6" />
              </svg>
              Receipt
            </button>

            <a
              href={directionsHref(order.branch)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg
                         bg-farhat text-white text-xs font-semibold
                         hover:opacity-90 transition-opacity"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                   className="w-4 h-4" aria-hidden="true">
                <path d="M3 11l18-8-8 18-2-8-8-2z" />
              </svg>
              Directions
            </a>
          </div>
        </div>

        {order.is_halted && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200
                          px-3.5 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Paused for the moment
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80">
              Something needs sorting before we carry on. We’ll be in touch.
            </p>
          </div>
        )}

        <div className="mt-6 lg:flex lg:gap-7 lg:items-start">

          {/* ── The record ───────────────────────────────────── */}

          <div className="lg:flex-1 lg:min-w-0">

            <div className="rounded-xl border border-rule divide-y divide-rule">
              {lines.map(line => (
                <LineRow key={line.id} line={line} />
              ))}
            </div>

            <div className="mt-6 grid sm:grid-cols-2 gap-6">
              <div>
                <h2 className="text-[0.95rem] font-semibold">Payment</h2>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="w-8 h-5 rounded bg-substrate grid place-items-center
                                   shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                         className="w-3.5 h-3.5 text-body" aria-hidden="true">
                      <rect x="6" y="2.5" width="12" height="19" rx="2" />
                      <path d="M11 18.5h2" />
                    </svg>
                  </span>
                  <span className="text-sm">
                    {paymentLabel(order)}
                  </span>
                </div>
                {order.paid_at && (
                  <p className="mt-1.5 text-xs text-body">
                    Paid in full, {dateLabel(order.paid_at)}
                  </p>
                )}
              </div>

              <div>
                <h2 className="text-[0.95rem] font-semibold">Collection</h2>
                {order.branch ? (
                  <>
                    <p className="mt-2.5 text-sm font-semibold">
                      {order.branch.name}
                    </p>
                    {order.branch.address && (
                      <p className="mt-1 text-xs leading-relaxed text-body">
                        {order.branch.address}
                      </p>
                    )}
                    {order.branch.phone && (
                      <a href={`tel:${order.branch.phone}`}
                         className="mt-1.5 inline-block text-xs font-semibold
                                    text-farhat">
                        {order.branch.phone}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="mt-2.5 text-sm text-body">
                    We’ll confirm where to collect shortly.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-rule">
              {Number(order.discount_amount) > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-body">Items</span>
                    <span className="tabular-nums">GHS {order.full_total}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="text-emerald-700">
                      {order.discount_reason}
                    </span>
                    <span className="tabular-nums text-emerald-700">
                      − GHS {order.discount_amount}
                    </span>
                  </div>
                </>
              )}

              <div className="mt-3 pt-3 border-t border-rule flex items-baseline
                              justify-between">
                <span className="text-[0.95rem] font-semibold">Paid</span>
                <span className="text-xl font-extrabold tabular-nums">
                  GHS {order.total}
                </span>
              </div>
            </div>
          </div>

          {/* ── Where it's got to ────────────────────────────── */}

          <aside className="mt-7 lg:mt-0 lg:w-[270px] shrink-0">
            <div className="rounded-xl border border-rule bg-substrate/40 px-4 py-4">
              <h2 className="text-[0.95rem] font-semibold">Where it’s got to</h2>

              <ol className="mt-3.5">
                {STAGES.map((stage, i) => {
                  const done = i < reached
                  const current = i === reached
                  const last = i === STAGES.length - 1

                  return (
                    <li key={stage.key} className="relative flex gap-2.5 pb-3.5
                                                   last:pb-0">
                      {!last && (
                        <span className={`absolute left-[11px] top-[25px] bottom-0 w-0.5
                                          ${done ? 'bg-emerald-600' : 'bg-rule'}`} />
                      )}

                      <span className={`relative z-[1] shrink-0 w-6 h-6 rounded-full
                                        grid place-items-center
                                        ${done ? 'bg-emerald-600'
                                          : current ? 'bg-farhat ring-[3.5px] ring-farhat/15'
                                          : 'border-2 border-rule bg-white'}`}>
                        {done && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="3" strokeLinecap="round"
                               strokeLinejoin="round"
                               className="w-3 h-3 text-white" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7" />
                          </svg>
                        )}
                        {current && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>

                      <div className="pt-0.5 min-w-0">
                        <p className={`text-xs leading-tight ${
                          current ? 'font-bold text-farhat'
                          : done ? 'font-semibold'
                          : 'font-semibold text-body/60'
                        }`}>
                          {stage.label}
                        </p>
                        {times[stage.key] && (
                          <p className="mt-1 text-[0.7rem] text-body">
                            {timeLabel(times[stage.key])}
                          </p>
                        )}
                        {current && !times[stage.key] && !estimateFor(order, stage.key) && (
                          <p className="mt-1 text-[0.7rem] text-body">Now</p>
                        )}
                        {current && estimateFor(order, stage.key) && (
                          <p className={`mt-1 text-[0.7rem] font-semibold ${
                            estimateFor(order, stage.key).held_up
                              || estimateFor(order, stage.key).running_over
                              ? 'text-amber-700' : 'text-emerald-700'
                          }`}>
                            {estimateText(estimateFor(order, stage.key))}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>

            {order.branch && (
              <div className="mt-3">
                <CollectionMap branch={order.branch} />
              </div>
            )}

            <p className="mt-3 text-[0.7rem] leading-relaxed text-center text-body">
              We’ll text you the moment it’s ready to collect.
            </p>
          </aside>
        </div>
      </div>
    </Shell>
  )
}

function LineRow({ line }) {
  const photo = serviceImage(line.base_name || line.service_name)
  const spec = line.specifications || {}
  const area = spec.width_in && spec.height_in
    ? (Number(spec.width_in) * Number(spec.height_in)) / 144
    : null

  return (
    <div className="px-3.5 py-3 flex items-center gap-3">
      {photo ? (
        <img src={photo} alt="" className="w-[52px] h-[52px] rounded-lg object-cover
                                           border border-rule shrink-0" />
      ) : (
        <div className="w-[52px] h-[52px] rounded-lg bg-substrate border border-rule
                        shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{line.service_name}</p>
        {(spec.width_in || area) && (
          <p className="mt-0.5 text-xs text-body">
            {spec.width_in && spec.height_in && (
              <>{spec.width_in} × {spec.height_in} in</>
            )}
            {area && (
              <>
                <span className="mx-1.5 text-rule">|</span>
                {area.toFixed(1)} sq ft
              </>
            )}
          </p>
        )}
        {line.addons?.length > 0 && (
          <p className="mt-0.5 text-xs text-body">
            {line.addons
              .map(a => `+ ${a.service_name}${a.detail ? ` (${a.detail})` : ''} × ${a.quantity}`)
              .join(' · ')}
          </p>
        )}
        {line.artwork_filename && (
          <p className={`mt-1 flex items-center gap-1 text-[0.7rem] font-semibold ${
            line.artwork_verdict === 'warn' ? 'text-amber-700' : 'text-emerald-700'
          }`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0"
                 aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 7.2l-6.1 6.9a1 1 0 0 1-1.5 0L6 12.6a1 1 0 0 1 1.5-1.3l2.6 2.9 5.4-6.1A1 1 0 0 1 17 9.2z" />
            </svg>
            <span className="truncate">{line.artwork_filename}</span>
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold tabular-nums">GHS {line.total}</p>
        <p className="mt-1 text-xs text-body tabular-nums">Qty: {line.quantity}</p>
      </div>
    </div>
  )
}

function FindOrder({ navigate }) {
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [looking, setLooking] = useState(false)
  const [problem, setProblem] = useState('')

  async function look() {
    setLooking(true)
    setProblem('')
    try {
      const { data } = await findOrder(number.trim(), phone.trim())
      navigate(`/track/${data.order_number}?t=${data.token}`, { replace: true })
    } catch (err) {
      setProblem(
        err.response?.status === 429
          ? 'Too many tries. Wait a little, or call us on 030 000 0000.'
          : err.response?.data?.detail ||
            'We couldn’t find that one. Check both and try again.',
      )
      setLooking(false)
    }
  }

  return (
    <Shell>
      <div className="py-10 max-w-sm">
        <h1 className="text-xl font-bold">Track an order</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-body">
          The link we texted you goes straight there. If you’ve lost it, your
          order number and phone number will do.
        </p>

        <label className="block mt-5">
          <span className="block mb-1.5 text-xs text-body">Order number</span>
          <input
            value={number}
            onChange={e => setNumber(e.target.value.toUpperCase())}
            placeholder="ORD-2026-00042"
            className="w-full px-3 py-2.5 rounded-lg border border-rule text-[0.95rem]
                       tracking-wide placeholder:text-body/40
                       focus:outline-none focus:border-ink"
          />
        </label>

        <label className="block mt-3">
          <span className="block mb-1.5 text-xs text-body">Phone number</span>
          <input
            type="tel" inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && number.trim() && phone.trim()) look()
            }}
            placeholder="024 000 0000"
            className="w-full px-3 py-2.5 rounded-lg border border-rule text-[0.95rem]
                       placeholder:text-body/40 focus:outline-none focus:border-ink"
          />
        </label>

        <button
          disabled={looking || !number.trim() || !phone.trim()}
          onClick={look}
          className="mt-4 w-full px-4 py-3 rounded-lg bg-farhat text-white text-sm
                     font-semibold disabled:opacity-40 hover:opacity-90
                     transition-opacity"
        >
          {looking ? 'Looking…' : 'Find my order'}
        </button>

        {problem && <p className="mt-3 text-sm text-farhat">{problem}</p>}

        <p className="mt-5 text-xs leading-relaxed text-body">
          Still stuck? Call us on{' '}
          <a href="tel:0300000000" className="font-semibold text-farhat">
            030 000 0000
          </a>{' '}
          and we’ll look it up for you.
        </p>
      </div>
    </Shell>
  )
}

/**
 * How long the stage they are in has left, if the floor knows. The server
 * works it out on every look and the page looks every minute, so a job
 * running long or a machine going down shows without a reload.
 */
function estimateFor(order, stageKey) {
  const e = order.stage_estimate
  return e && e.stage === stageKey ? e : null
}

function estimateText(e) {
  if (e.held_up) return 'A short delay, we’re on it'
  if (e.running_over) return 'Taking a little longer than usual'

  // Work that runs past closing carries on next morning: say the day
  // rather than a count of minutes that includes the night.
  if (e.ready_at) {
    const at = new Date(e.ready_at)
    const now = new Date()
    if (at.toDateString() !== now.toDateString()) {
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      const day = at.toDateString() === tomorrow.toDateString()
        ? 'tomorrow'
        : at.toLocaleDateString('en-GB', { weekday: 'long' })
      const time = at.toLocaleTimeString('en-GB', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      })
      return `Done ${day}, about ${time}`
    }
  }

  const m = Number(e.minutes_left) || 0
  if (m < 60) return `About ${m} min left`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return `About ${h} hr${rest ? ` ${rest} min` : ''} left`
}

function stageOf(order) {
  if (order.handover_state === 'HANDED_OVER') return 'ready'
  switch (order.work_state) {
    case 'DONE': return 'ready'
    case 'FINISHING':
    case 'QUALITY_CHECK': return 'finishing'
    case 'IN_PRODUCTION': return 'press'
    case 'RECEIVED': return 'inspecting'
    default: return 'paid'
  }
}

/**
 * How it was paid. Paystack tells us the channel on the webhook, so
 * this is their word rather than our guess.
 */
function paymentLabel(order) {
  const channel = {
    mobile_money: 'Mobile money',
    card: 'Card',
    bank: 'Bank transfer',
    bank_transfer: 'Bank transfer',
    ussd: 'USSD',
  }[order.payment_channel] || 'Paid online'

  return order.payment_last4
    ? `${channel} ·· ${order.payment_last4}`
    : channel
}

function directionsHref(branch) {
  if (branch?.latitude && branch?.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`
  }
  const query = encodeURIComponent(
    `${branch?.name || 'Farhat Printing Press'} ${branch?.address || 'Accra'}`,
  )
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

function dateLabel(when) {
  const at = new Date(when)
  return `${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${
    at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
  }`
}

function timeLabel(when) {
  const at = new Date(when)
  const time = at.toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const today = new Date().toDateString() === at.toDateString()
  return today ? time
    : `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
}

function readyLabel(when) {
  const at = new Date(when)
  const time = at.toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const today = new Date().toDateString() === at.toDateString()
  return today ? `${time} today`
    : `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
}

function Shell({ orderNumber, children }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <Header back orderNumber={orderNumber} />
      <main className="max-w-4xl mx-auto px-5">{children}</main>
    </div>
  )
}



// ── The app's order details ──────────────────────────────────────

// The customer's words for each step, collected included.
const APP_STEPS = [
  { key: 'paid', label: 'Order received' },
  { key: 'inspecting', label: 'Checking your file' },
  { key: 'press', label: 'In press' },
  { key: 'finishing', label: 'Finishing' },
  { key: 'ready', label: 'Ready to collect' },
  { key: 'collected', label: 'Collected' },
]

// An icon of what happens at each step.
const STEP_ICON = {
  paid: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 9l2 2 4-4" /></>,
  inspecting: <><path d="M14 3H6v18h7" /><path d="M14 3l4 4v3" /><circle cx="16.5" cy="16.5" r="3" /><path d="M19 19l2 2" /></>,
  press: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  finishing: <><circle cx="6" cy="17" r="2.5" /><circle cx="6" cy="7" r="2.5" /><path d="M8 8.5L20 18M8 15.5L20 6" /></>,
  ready: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  collected: <><path d="M7 11V7a5 5 0 0 1 10 0" /><path d="M4 11h16l-1 9H5z" /><path d="M10 15l2 2 3-3" /></>,
}

// What kind of job this is, for the words: a banner or sticker printed
// to size, document pages, or cards.
function jobKind(lines) {
  const first = lines[0] || {}
  const n = `${first.base_name || ''} ${first.service_name || ''}`.toLowerCase()
  if ((first.specifications || {}).width_in) return /sticker|sav/.test(n) ? 'sticker' : 'banner'
  if (/card/.test(n)) return 'cards'
  return 'pages'
}

// The finishing this customer actually chose, in a few words.
function finishingWords(lines) {
  const names = lines.flatMap(l => (l.addons || []).map(a => (a.service_name || '').replace(/\s*\(.*\)$/, '')))
  const unique = [...new Set(names.map(n => n.replace(/^A[3-5]\s+/, '').toLowerCase()))]
  return unique
}

function explain(key, order, lines) {
  const kind = jobKind(lines)
  const finishing = finishingWords(lines)
  const branch = order.branch?.name || 'Westland Branch'
  const what = { banner: 'banner', sticker: 'stickers', cards: 'business cards', pages: 'pages' }[kind]
  switch (key) {
    case 'paid':
      return 'We’ve got your order and your payment. It’s in the queue to be checked.'
    case 'inspecting':
      return kind === 'pages'
        ? 'A coordinator is checking your file: the pages, the sides and the copies you asked for, so it prints right the first time.'
        : 'A coordinator is checking your artwork against the size you chose, so it prints right the first time.'
    case 'press':
      return kind === 'banner' || kind === 'sticker'
        ? `Your ${what} ${kind === 'sticker' ? 'are' : 'is'} printing on our large-format printer. Big jobs print in passes, so it takes a little while.`
        : `Your ${what} ${kind === 'cards' ? 'are' : 'are'} printing now.`
    case 'finishing': {
      const base = kind === 'banner' ? ['trimming'] : kind === 'sticker' ? [] : kind === 'cards' ? ['cutting'] : []
      const all = [...base, ...finishing]
      return all.length
        ? `Now the finishing: ${all.join(', ')}. Then a final check against your order.`
        : 'A final check against your order before it’s packed.'
    }
    case 'ready':
      return `Checked and packed. Bring your order number to ${branch}.`
    case 'collected':
      return 'Handed over. Thank you for printing with us.'
    default:
      return ''
  }
}

// One line about a step still to come.
function preview(key, order, lines) {
  const finishing = finishingWords(lines)
  switch (key) {
    case 'inspecting': return 'We check your file before anything is printed'
    case 'press': return 'Your job goes on the printer'
    case 'finishing': return finishing.length ? `${finishing.join(', ')} and a final check` : 'A final check against your order'
    case 'ready': return 'We’ll tell you the moment it’s packed'
    case 'collected': return `Handed over at ${order.branch?.name?.replace(' Branch', '') || 'Westland'}`
    default: return ''
  }
}

function Progress({ order, stage }) {
  const lines = order.line_items || []
  const reached = APP_STEPS.findIndex(s => s.key === stage)
  const times = order.stage_times || {}
  const finished = stage === 'ready' || stage === 'collected'

  return (
    <AppCard title="Progress">
      <ol className="px-4 pt-3.5 pb-4">
        {APP_STEPS.map((s, i) => {
          const isDone = i < reached || (i === reached && stage === 'collected')
          const isNow = i === reached && stage !== 'collected'
          const last = i === APP_STEPS.length - 1
          const est = isNow ? estimateFor(order, s.key) : null
          const fact = s.key === 'paid' ? paymentLabel(order).toLowerCase()
            : s.key === 'inspecting' && isDone ? 'passed' : null
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span className={`absolute left-[17px] top-10 bottom-0.5 w-0.5
                                  ${i < reached ? 'bg-farhat' : 'bg-[#ece9e3]'}`} />
              )}
              <span className={`relative z-[1] w-9 h-9 rounded-full grid place-items-center shrink-0
                ${isDone ? 'bg-farhat text-white'
                  : isNow ? (finished ? 'bg-emerald-600 text-white ring-[5px] ring-emerald-600/15'
                                      : 'bg-white text-farhat border-2 border-farhat ring-[5px] ring-farhat/12')
                  : 'bg-[#f3f1ec] text-[#b9b4ab]'}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden="true">
                  {STEP_ICON[s.key]}
                </svg>
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`text-sm leading-tight ${isNow || isDone ? 'font-bold' : 'font-semibold text-[#a8a29e]'}`}>
                  {s.label}
                  {est && (
                    <span className={`ml-1.5 align-[1px] inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-bold
                                      ${est.held_up || est.running_over ? 'bg-amber-50 text-amber-800' : 'bg-[#fdeccf] text-[#8a5a00]'}`}>
                      {estimateText(est)}
                    </span>
                  )}
                </p>
                {(isDone || isNow) && (times[s.key] || fact) && (
                  <p className="mt-0.5 text-xs text-body">
                    {[times[s.key] && (isNow && !finished ? `Started ${timeLabel(times[s.key])}` : timeLabel(times[s.key])), fact]
                      .filter(Boolean).join(' · ')}
                  </p>
                )}
                {isNow && (
                  <p className={`mt-2 text-[0.78rem] leading-relaxed rounded-xl px-3 py-2.5
                                 ${finished ? 'bg-emerald-50 text-emerald-900/80' : 'bg-[#fdf6f6] text-ink/70'}`}>
                    {explain(s.key, order, lines)}
                  </p>
                )}
                {!isDone && !isNow && (
                  <p className="mt-0.5 text-xs text-body/70">{preview(s.key, order, lines)}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </AppCard>
  )
}

function appStage(order) {
  return order.handover_state === 'HANDED_OVER' ? 'collected' : stageOf(order)
}

function lineDetail(line) {
  const spec = line.specifications || {}
  const q = Number(line.quantity) || 1
  if (spec.width_in && spec.height_in) {
    const size = i => (Number(i) % 12 === 0 ? `${Number(i) / 12}ft` : `${i}in`)
    return `${size(spec.width_in)} × ${size(spec.height_in)}${q > 1 ? ` · ${q} pieces` : ''}`
  }
  if (/card/i.test(line.base_name || line.service_name || '')) return `${q} box${q === 1 ? '' : 'es'}`
  return `${q} cop${q === 1 ? 'y' : 'ies'}`
}

function AppCard({ title, children, className = '' }) {
  return (
    <section className={`mt-4 rounded-2xl border border-[#ece9e3] bg-white ${className}`}>
      {title && <h2 className="px-4 pt-3.5 text-sm font-bold">{title}</h2>}
      {children}
    </section>
  )
}

// The top card's look for each kind of moment.
const TONE = {
  making: { card: 'border-farhat/25', head: 'bg-[#fdf0f0]', icon: 'bg-farhat', title: 'text-farhat', sub: 'text-ink/60', chip: 'border-farhat/20 text-farhat' },
  ready: { card: 'border-[#c9ecd6]', head: 'bg-[#e8f7ee]', icon: 'bg-green-600', title: 'text-[#0d5c33]', sub: 'text-[#4b7a5e]', chip: 'border-[#cfe9d9] text-green-800' },
  collected: { card: 'border-[#e5e2dc]', head: 'bg-[#f3f1ec]', icon: 'bg-stone-400', title: 'text-ink/70', sub: 'text-body', chip: 'border-[#e5e2dc] text-ink/70' },
}

function fileKind(name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return ext === 'pdf' ? 'PDF' : ['doc', 'docx'].includes(ext) ? 'DOC' : 'IMG'
}

/**
 * Everything about the order in one card: where it stands as the
 * headline, its number and when it was paid (with how), and what was
 * ordered, each item folding open to its lines, finishing and file.
 */
function OrderCard({ order, stage, onDirections }) {
  const [open, setOpen] = useState(() => new Set())
  const [copied, setCopied] = useState(false)
  // Collected while they watch: a brief green tick, so the customer at
  // the counter sees the handover land.
  const [justCollected, setJustCollected] = useState(false)
  const wasStage = useRef(stage)
  useEffect(() => {
    if (wasStage.current === 'ready' && stage === 'collected') {
      setJustCollected(true)
      const t = setTimeout(() => setJustCollected(false), 2500)
      return () => clearTimeout(t)
    }
    wasStage.current = stage
    return undefined
  }, [stage])
  const lines = order.line_items || []
  const times = order.stage_times || {}
  const branch = order.branch?.name || 'Westland Branch'
  const mood = stage === 'collected' ? 'collected' : stage === 'ready' ? 'ready' : 'making'
  const tone = TONE[mood]
  const step = APP_STEPS.find(s => s.key === stage)
  const est = mood === 'making' ? estimateFor(order, stage) : null

  const headline = mood === 'ready' ? 'Ready to collect' : mood === 'collected' ? 'Collected' : step?.label || 'In progress'
  const sub = mood === 'ready' ? `Your order is ready at ${branch}`
    : mood === 'collected' ? 'Thank you for printing with us'
    : est ? estimateText(est)
    : 'We’re on it'
  const when = mood === 'ready' && times.ready ? `Since ${dateLabel(times.ready)}`
    : mood === 'making' && order.promised_for ? `Ready about ${readyLabel(order.promised_for)}`
    : null

  async function copy() {
    try {
      await navigator.clipboard.writeText(order.order_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* the number is on screen to be read */ }
  }

  const toggle = id => setOpen(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <section className={`rounded-[20px] border bg-white overflow-hidden ${tone.card}`}>
      {/* Where it stands. */}
      <div className={`flex gap-3 px-3.5 pt-3.5 pb-4 ${tone.head}`}>
        <span className={`w-11 h-11 rounded-full grid place-items-center shrink-0 text-white ring-[6px] ring-white/60 ${tone.icon}
                          ${justCollected ? '!bg-green-600 scale-110 transition-transform duration-500' : 'transition-transform duration-500'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
            {mood === 'making' ? STEP_ICON[stage] : <path d="M5 12.5l4.5 4.5L19 7" />}
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-lg font-extrabold leading-tight ${tone.title}`}>{headline}</p>
          <p className={`mt-0.5 text-xs ${tone.sub}`}>{sub}</p>
          {when && <p className={`text-xs ${tone.sub} opacity-80`}>{when}</p>}
          <a href={directionsHref(order.branch)} target="_blank" rel="noreferrer"
             onClick={e => { if (onDirections) { e.preventDefault(); onDirections() } }}
             className={`mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border text-[0.7rem] font-bold ${tone.chip}`}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3" aria-hidden="true">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
            {branch}
            <span aria-hidden="true">›</span>
          </a>
        </div>
      </div>

      {/* The collection pass: the QR and the PIN, only while it waits to
          be collected. The attendant scans the QR, or takes the phone
          number and the PIN. Never shown anywhere public. */}
      {mood === 'ready' && order.collection_pin && (
        <div className="mx-3 mt-3 rounded-2xl border border-[#c9ecd6] bg-white overflow-hidden">
          <p className="pt-3 text-center text-xs font-bold text-green-800">Show this at the counter</p>
          <div className="mt-2 mx-auto w-[150px] h-[150px] p-2 bg-white">
            <QRCode value={`PO:${order.order_number}:${order.collection_pin}`}
                    size={134} style={{ width: '100%', height: '100%' }} />
          </div>
          <p className="mt-1 text-center text-[0.7rem] text-body">or give your phone number and this PIN</p>
          <div className="mt-1.5 flex justify-center gap-1.5">
            {order.collection_pin.split('').map((d, i) => (
              <span key={i} className="w-9 h-11 rounded-xl bg-[#ecf9f1] border border-[#cfe9d9] grid place-items-center
                                       text-xl font-black text-[#0d5c33] tabular-nums">{d}</span>
            ))}
          </div>
          <p className="py-3 text-center text-[0.68rem] text-body">Sending someone? Share the PIN with them.</p>
        </div>
      )}

      {/* Which order, and when it was paid. */}
      <div className="grid grid-cols-2 px-3.5 pt-3.5">
        <div className="flex gap-2 min-w-0">
          <span className="w-8 h-8 rounded-[10px] bg-farhat/10 text-farhat grid place-items-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                 strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
              <path d="M7 3h7l4 4v14H7z" /><path d="M10 12h5M10 16h5" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] text-body">Order number</p>
            <button onClick={copy} className="flex items-center gap-1 text-[0.8rem] font-extrabold tabular-nums">
              <span className="truncate">{order.order_number}</span>
              <span className="text-[0.6rem] font-semibold text-body">{copied ? 'Copied' : '⧉'}</span>
            </button>
          </div>
        </div>
        <div className="flex gap-2 min-w-0 pl-3 border-l border-[#f0ede8]">
          <span className="w-8 h-8 rounded-[10px] bg-farhat/10 text-farhat grid place-items-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                 strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] text-body">Paid on</p>
            <p className="text-[0.8rem] font-extrabold">{order.paid_at ? dateLabel(order.paid_at) : '—'}</p>
            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-[#e8f7ee] text-green-800 text-[0.6rem] font-bold">
              {paymentLabel(order)}
            </span>
          </div>
        </div>
      </div>

      {/* What was ordered: each item folds open. */}
      <div className="px-3 pt-3 space-y-2">
        {lines.map(line => {
          const isOpen = open.has(line.id)
          const photo = serviceImage(line.base_name || line.service_name)
          return (
            <div key={line.id} className="rounded-2xl border border-[#ece9e3] overflow-hidden">
              <button onClick={() => toggle(line.id)} aria-expanded={isOpen}
                      className="w-full flex items-center gap-2.5 p-2.5 text-left">
                {photo ? (
                  <img src={photo} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-xl bg-[#fdecec] grid place-items-center shrink-0">
                    <ProductBadge name={line.base_name || line.service_name} onLight />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.85rem] font-extrabold leading-snug">{line.service_name}</span>
                  <span className="block text-xs text-body">{lineDetail(line)} · GHS {line.total}</span>
                </span>
                <span className={`w-7 h-7 rounded-full bg-[#f3f1ec] grid place-items-center shrink-0 transition-transform duration-300
                                  ${isOpen ? 'rotate-180' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                       strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-ink/70" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-[350ms] ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="bg-[#fafaf8] border-t border-[#f0ede8] px-3 py-2 space-y-1.5">
                    <Receipt icon={<><path d="M7 3h7l4 4v14H7z" /><path d="M10 12h5M10 16h5" /></>}
                             title={line.service_name} note={lineDetail(line)} price={`GHS ${line.total}`} />
                    {(line.addons || []).map((a, i) => (
                      <Receipt key={i} icon={<><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></>}
                               title={a.service_name} note={a.detail || `× ${a.quantity}`}
                               price={a.total ? (Number(a.total) > 0 ? `GHS ${a.total}` : 'Free') : ''} />
                    ))}
                    {line.artwork_filename && (
                      <div className="flex items-center gap-2.5 pt-2 mt-1 border-t border-[#ece9e3]">
                        <span className="w-8 h-8 rounded-[10px] bg-farhat/10 text-farhat grid place-items-center shrink-0
                                         text-[0.55rem] font-black">{fileKind(line.artwork_filename)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold truncate">{line.artwork_filename}</span>
                          <span className="block text-[0.68rem] text-body">
                            1 file · {line.artwork_verdict === 'warn' ? 'prints a little soft, accepted' : 'checked, good to print'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* What was paid. */}
      <div className="mx-3.5 mt-3 mb-3.5 pt-2.5 border-t border-dashed border-[#e5e2dc]">
        {Number(order.discount_amount) > 0 && (
          <div className="flex justify-between text-xs text-emerald-700 mb-1">
            <span>{order.discount_reason}</span><span>− GHS {order.discount_amount}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-body">Total paid</span>
          <span className="text-lg font-black tabular-nums">GHS {order.total}</span>
        </div>
      </div>
    </section>
  )
}

function Receipt({ icon, title, note, price }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-[10px] bg-[#f3f1ec] text-ink/60 grid place-items-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">{icon}</svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold">{title}</span>
        {note && <span className="block text-[0.68rem] text-body">{note}</span>}
      </span>
      <span className="text-xs font-semibold tabular-nums shrink-0">{price}</span>
    </div>
  )
}

function AppTrack({ order }) {
  const stage = appStage(order)
  const navigate = useNavigate()
  const openDirections = () => navigate('/directions', { state: { branch: order.branch } })

  // Collected while they watch: count down 10 seconds, with a way to
  // stay, then fold the order away and move on: to their other orders if
  // any are still active, otherwise to the catalogue to print something
  // new. Opening an already-collected order later never does this.
  const queryClient = useQueryClient()
  const [countdown, setCountdown] = useState(null)
  const [folding, setFolding] = useState(false)
  const lastStage = useRef(stage)
  useEffect(() => {
    if (lastStage.current === 'ready' && stage === 'collected') setCountdown(10)
    lastStage.current = stage
  }, [stage])
  useEffect(() => {
    if (countdown == null) return undefined
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => (c == null ? c : c - 1)), 1000)
      return () => clearTimeout(t)
    }
    setFolding(true)
    const t = setTimeout(async () => {
      let next = '/categories'
      try {
        const mine = await queryClient.fetchQuery({
          queryKey: ['my-orders'],
          queryFn: () => accountOrders().then(r => r.data),
        })
        if ((mine.active || []).length) next = '/orders'
      } catch { /* the catalogue is never a wrong place to land */ }
      navigate(next, { replace: true })
    }, 500)
    return () => clearTimeout(t)
  }, [countdown, navigate, queryClient])
  const branch = order.branch
  const phone = branch?.phone || '0556244194'

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className={`max-w-md mx-auto px-4 pb-10 origin-top transition-all duration-500 ease-in
                        ${folding ? 'scale-y-0 opacity-0' : ''}`}>
        <OrderCard order={order} stage={stage} onDirections={order.branch ? openDirections : null} />

        {order.is_halted && (
          <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Paused for the moment</p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80">
              Something needs sorting before we carry on. We’ll be in touch.
            </p>
          </div>
        )}

        {/* Where it has got to, and what each step means. */}
        <Progress order={order} stage={stage} />

        {/* Where to collect. */}
                {/* Where to collect: one map, one Directions, one Call. */}
        <AppCard title="Collect at">
          <div className="px-3 pt-2 pb-3">
            {order.branch ? (
              <CollectionMap branch={order.branch} onOpen={openDirections} />
            ) : (
              <p className="px-1 text-sm text-body">Westland Branch, 53 Westland Avenue, Accra</p>
            )}
          </div>
        </AppCard>

        <p className="mt-5 text-center text-xs text-body">
          {stage === 'collected' ? 'Thank you for printing with us.'
            : 'We’ll tell you the moment it’s ready to collect.'}
        </p>
      </main>

      {countdown != null && !folding && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4"
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <div className="max-w-md mx-auto flex items-center gap-3 rounded-2xl bg-[#0d5c33] text-white
                          px-4 py-3 shadow-lg">
            <span className="w-8 h-8 rounded-full bg-white/15 grid place-items-center font-black">✓</span>
            <p className="flex-1 text-sm">
              <b>All done!</b> Taking you on in <b className="tabular-nums">{countdown}</b>…
            </p>
            <button onClick={() => setCountdown(null)}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#0d5c33] text-xs font-bold">
              Stay here
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
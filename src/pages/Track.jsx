import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getOrder, findOrder } from '../api/client'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'
import CollectionMap from '../components/CollectionMap.jsx'

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
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['tracked-order', orderNumber],
    queryFn: () => getOrder(orderNumber, token).then(r => r.data),
    retry: false,
    // A customer watching this wants it to move on its own rather than
    // being told to refresh.
    refetchInterval: 60_000,
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
  const photo = serviceImage(line.service_name)
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
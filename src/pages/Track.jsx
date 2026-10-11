import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getOrder } from '../api/client'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'

/**
 * Where an order has got to.
 *
 * Reached from the link in the text message, which carries the order
 * number and its token. There are no accounts here, so the token is
 * what proves the order is yours — the number alone is sequential and
 * would let anyone read anyone's.
 *
 * The stages run down rather than across because each one has
 * something to say. A horizontal bar can carry five words; this can
 * carry a line explaining what is happening and when it happened, and
 * a customer watching their banner wants both.
 *
 * The words are the customer's, not the floor's. Quality check folds
 * into finishing: naming it invites the question of what might be
 * wrong with theirs, and the answer is almost always nothing.
 */

const STAGES = [
  {
    key: 'paid',
    label: 'Paid',
    note: 'We have your order and your artwork',
    icon: (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  {
    key: 'inspecting',
    label: 'Inspecting',
    note: 'Checked over before it goes on',
    icon: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  {
    key: 'press',
    label: 'In press',
    note: 'On the machine now',
    icon: (
      <>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="7" />
      </>
    ),
  },
  {
    key: 'finishing',
    label: 'Finishing',
    note: 'Cut, hemmed and checked',
    icon: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="M20 4L8.5 16.5" />
        <path d="M14.5 14.5L20 20" />
        <path d="M8.5 7.5L11 10" />
      </>
    ),
  },
  {
    key: 'ready',
    label: 'Ready to collect',
    note: 'We’ll text you',
    icon: (
      <>
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M4 9h16v11H4z" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
  },
]

export default function Track() {
  const { orderNumber } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const token = params.get('t')
  if (!orderNumber || !token) return <FindOrder navigate={navigate} />

  return <OrderState orderNumber={orderNumber} token={token} />
}

function OrderState({ orderNumber, token }) {
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
      <div className="py-6">

        <div className="rounded-xl border border-rule bg-substrate/40 px-4 py-3.5
                        flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">
              {STAGES[Math.max(0, reached)].label === 'Ready to collect'
                ? 'Ready to collect'
                : headline(order, STAGES[Math.max(0, reached)].key)}
            </p>
            {order.job_number && (
              <p className="mt-0.5 text-xs text-body">Job {order.job_number}</p>
            )}
          </div>
          {order.promised_for && reached < STAGES.length - 1 && (
            <div className="text-right shrink-0">
              <p className="text-[0.7rem] text-body">Ready about</p>
              <p className="text-sm font-bold tabular-nums">
                {readyLabel(order.promised_for)}
              </p>
            </div>
          )}
        </div>

        {order.is_halted && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200
                          px-3.5 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Paused for the moment
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80">
              Something needs sorting before we carry on. We’ll be in touch.
            </p>
          </div>
        )}

        {/* ── Where it's got to ──────────────────────────────── */}

        <h2 className="mt-7 mb-3.5 text-[0.95rem] font-semibold">
          Where it’s got to
        </h2>

        <ol className="relative">
          {STAGES.map((stage, i) => {
            const done = i < reached
            const current = i === reached
            const last = i === STAGES.length - 1

            return (
              <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
                {/* The line joins this marker to the next, and is
                    coloured by whether the work has passed it. */}
                {!last && (
                  <span className={`absolute left-[14px] top-[30px] bottom-0 w-0.5
                                    ${done ? 'bg-emerald-600' : 'bg-rule'}`} />
                )}

                <span className={`relative z-[1] shrink-0 w-[30px] h-[30px] rounded-full
                                  grid place-items-center
                                  ${done ? 'bg-emerald-600'
                                    : current ? 'bg-farhat ring-4 ring-farhat/15'
                                    : 'border-2 border-rule bg-white'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                       className={`w-[15px] h-[15px] ${
                         done || current ? 'text-white' : 'text-body/40'
                       }`} aria-hidden="true">
                    {stage.icon}
                  </svg>
                </span>

                <div className="pt-0.5 min-w-0">
                  <p className={`text-sm leading-tight ${
                    current ? 'font-bold text-farhat'
                    : done ? 'font-semibold'
                    : 'font-semibold text-body/70'
                  }`}>
                    {stage.label}
                  </p>
                  <p className={`mt-1 text-xs leading-relaxed ${
                    done || current ? 'text-body' : 'text-body/60'
                  }`}>
                    {stage.note}
                    {times[stage.key] && (
                      <span className="text-body/70"> · {timeLabel(times[stage.key])}</span>
                    )}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>

        {/* ── What's in it ───────────────────────────────────── */}

        <h2 className="mt-7 mb-3 text-[0.95rem] font-semibold">What’s in it</h2>

        <div className="rounded-xl border border-rule divide-y divide-rule">
          {lines.map(line => (
            <div key={line.id} className="px-3 py-2.5 flex items-center gap-3">
              {serviceImage(line.service_name) ? (
                <img src={serviceImage(line.service_name)} alt=""
                     className="w-10 h-10 rounded-lg object-cover border border-rule
                                shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-substrate border border-rule
                                shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{line.service_name}</p>
                <p className="mt-0.5 text-xs text-body">{describe(line)}</p>
              </div>
              <p className="text-sm font-bold tabular-nums shrink-0">
                GHS {line.total}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-2.5 px-1 flex items-baseline justify-between">
          <span className="text-sm text-body">Paid</span>
          <span className="text-lg font-extrabold tabular-nums">
            GHS {order.total}
          </span>
        </div>

        {/* ── Where to get it ────────────────────────────────── */}

        {order.branch_name && (
          <div className="mt-5 rounded-xl border border-rule px-4 py-3.5
                          flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                 className="w-5 h-5 shrink-0 text-farhat" aria-hidden="true">
              <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                Collect at {order.branch_name}
              </p>
              {order.branch_address && (
                <p className="mt-0.5 text-xs text-body truncate">
                  {order.branch_address}
                </p>
              )}
            </div>

            {order.branch_phone && (
              <a href={`tel:${order.branch_phone}`}
                 aria-label={`Call ${order.branch_name}`}
                 className="shrink-0 text-farhat hover:opacity-70 transition-opacity">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                     className="w-5 h-5">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

/**
 * For someone who lost the text message.
 *
 * The order number and the phone they gave — the same pair the shop
 * would ask for across the counter, and the same pair a stranger would
 * struggle to guess together.
 */
function FindOrder({ navigate }) {
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')

  return (
    <Shell>
      <div className="py-10">
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
            placeholder="024 000 0000"
            className="w-full px-3 py-2.5 rounded-lg border border-rule text-[0.95rem]
                       placeholder:text-body/40 focus:outline-none focus:border-ink"
          />
        </label>

        <button
          disabled={!number.trim() || !phone.trim()}
          onClick={() => navigate(`/track/${number.trim()}?phone=${phone.trim()}`)}
          className="mt-4 w-full px-4 py-3 rounded-lg bg-farhat text-white text-sm
                     font-semibold disabled:opacity-40 hover:opacity-90
                     transition-opacity"
        >
          Find my order
        </button>

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

function headline(order, stage) {
  if (order.handover_state === 'HANDED_OVER') return 'Collected — thank you'
  return {
    paid: 'Paid — with the shop now',
    inspecting: 'Being looked over',
    press: 'On the press',
    finishing: 'Nearly there',
    ready: 'Ready to collect',
  }[stage]
}

function describe(line) {
  const spec = line.specifications || {}
  const size = spec.width_in && spec.height_in
    ? `${spec.width_in} × ${spec.height_in} in`
    : null
  const count = `${line.quantity} piece${line.quantity === 1 ? '' : 's'}`
  return size ? `${size} · ${count}` : count
}

function timeLabel(when) {
  const at = new Date(when)
  const time = at.toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const today = new Date().toDateString() === at.toDateString()
  if (today) return time
  return `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
}

function readyLabel(when) {
  const at = new Date(when)
  const time = at.toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const today = new Date().toDateString() === at.toDateString()
  if (today) return `${time} today`
  return `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
}

function Shell({ orderNumber, children }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <Header back orderNumber={orderNumber} />
      {/* Held to a readable column. A tracking page is one narrow
          story, and letting it run the width of a desktop screen makes
          every line a journey. */}
      <main className="w-full max-w-md mx-auto px-5">{children}</main>
    </div>
  )
}
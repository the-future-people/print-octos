import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getOrder } from '../api/client'
import { useCart } from '../lib/CartContext.jsx'
import Header from '../components/Header.jsx'

/**
 * Where Paystack sends a customer afterwards.
 *
 * Afterwards covers both outcomes: someone who paid and someone who
 * changed their mind on Paystack's page land on exactly the same URL.
 * So this cannot celebrate on arrival — it asks first.
 *
 * That asking is also the pause the webhook needs. Paystack posts to
 * us at the same moment it redirects them, and the two race; a few
 * seconds of looking lets ours arrive, and the looking is real work
 * rather than a staged wait.
 *
 * Then it moves them on to their order, because that page answers
 * every question this one would have to repeat.
 */

// Long enough for a webhook on a slow connection, short enough that
// nobody feels stranded. After this we tell them it is in hand rather
// than keep them watching — Paystack took the money either way.
const GIVE_UP_AFTER = 12_000
const ASK_EVERY = 1_500
const LINGER = 3_000

export default function Paid() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cart = useCart()

  const [state, setState] = useState('checking')
  const [order, setOrder] = useState(null)
  const started = useRef(Date.now())

  // Paystack sends the reference both ways round depending on the
  // channel, and either is our order number.
  const reference = params.get('reference') || params.get('trxref')
  const saved = cart.saved

  useEffect(() => {
    document.title = 'Payment — Farhat Printing Press'
  }, [])

  useEffect(() => {
    if (!saved || !reference) {
      setState('unknown')
      return
    }

    let live = true

    async function ask() {
      if (!live) return

      try {
        const { data } = await getOrder(saved.order_number, saved.access_token)
        setOrder(data)

        if (data.is_paid || data.status === 'PAID' || data.status === 'CONVERTED') {
          setState('paid')
          return
        }
      } catch {
        // The order may have been cleared, or the network dropped.
        // Either way, asking again is the right move until the clock
        // runs out.
      }

      if (Date.now() - started.current > GIVE_UP_AFTER) {
        // Paystack has the money whatever we can see. Telling someone
        // their payment failed when it did not is the worse mistake,
        // so we say it is in hand and let the text message catch up.
        setState('slow')
        return
      }

      setTimeout(ask, ASK_EVERY)
    }

    ask()
    return () => { live = false }
  }, [saved, reference])

  // Paid, and on to the order. Long enough to read, short enough not
  // to strand anyone.
  useEffect(() => {
    if (state !== 'paid' || !saved) return

    const timer = setTimeout(() => {
      // The cart is spent. The next thing they order starts a new one
      // rather than joining something already on the floor.
      cart.forget()
      navigate(
        `/track/${saved.order_number}?t=${saved.access_token}`,
        { replace: true },
      )
    }, LINGER)

    return () => clearTimeout(timer)
  }, [state, saved, navigate, cart])

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-5">
        {state === 'checking' && <Checking />}
        {state === 'paid' && <Done order={order} />}
        {state === 'slow' && <Slow saved={saved} navigate={navigate} />}
        {state === 'unknown' && <Unknown navigate={navigate} />}
      </main>
    </div>
  )
}

function Checking() {
  return (
    <div className="py-20 text-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" className="w-8 h-8 mx-auto text-farhat animate-spin"
           aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      <p className="mt-4 text-[0.95rem] font-semibold">Checking with the bank</p>
      <p className="mt-1 text-sm text-body">
        One moment — don’t close this page.
      </p>
    </div>
  )
}

function Done({ order }) {
  return (
    <div className="py-16 text-center">
      {/* Drawn rather than dropped in: a tick that arrives all at once
          reads as a picture, and one that draws reads as something
          that just happened. */}
      <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#047857"
                strokeWidth="3.5" strokeLinecap="round"
                transform="rotate(-90 32 32)"
                className="[stroke-dasharray:170] animate-[draw-ring_700ms_ease-out_forwards]" />
        <path d="M20 33 L28.5 41 L45 24" fill="none" stroke="#047857"
              strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              className="[stroke-dasharray:36] [stroke-dashoffset:36]
                         animate-[draw-tick_400ms_550ms_ease-out_forwards]" />
      </svg>

      <div className="animate-[pop-in_500ms_200ms_ease-out_both]">
        <h1 className="mt-4 text-xl font-extrabold">Paid — thank you</h1>
        {order && (
          <p className="mt-1.5 text-sm text-body tabular-nums">
            GHS {order.total} · {order.order_number}
          </p>
        )}

        {order?.branch && (
          <div className="mt-5 mx-auto max-w-[260px] rounded-xl border border-rule
                          bg-substrate/40 px-4 py-3 text-left">
            <p className="text-xs text-body">Collect at</p>
            <p className="mt-0.5 text-sm font-semibold">{order.branch.name}</p>
            {order.promised_for && (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Ready about {readyLabel(order.promised_for)}
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-body">Taking you to your order…</p>
        <div className="mt-2 mx-auto w-44 h-[3px] rounded-full bg-substrate
                        overflow-hidden">
          <div className="h-full bg-farhat rounded-full
                          animate-[fill-bar_3000ms_linear_forwards]" />
        </div>
      </div>
    </div>
  )
}

/**
 * The money is almost certainly taken and our side has not caught up.
 *
 * Saying "payment failed" here would be the worse mistake: a customer
 * told that will pay again.
 */
function Slow({ saved, navigate }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-substrate grid place-items-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round"
             className="w-6 h-6 text-body" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>

      <h1 className="mt-4 text-lg font-bold">We’re confirming your payment</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-body">
        It’s taking a little longer than usual. If the money left your
        account it has reached us — we’ll text you as soon as it clears.
      </p>

      {saved && (
        <button
          onClick={() => navigate(
            `/track/${saved.order_number}?t=${saved.access_token}`,
          )}
          className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm
                     font-semibold hover:opacity-90 transition-opacity"
        >
          See my order
        </button>
      )}

      <p className="mt-4 text-xs text-body">
        Worried? Call us on{' '}
        <a href="tel:0300000000" className="font-semibold text-farhat">
          030 000 0000
        </a>
      </p>
    </div>
  )
}

/**
 * They cancelled, or arrived here with nothing we recognise.
 *
 * Deliberately not phrased as a failure: nothing was taken, and the
 * order is still sitting where they left it.
 */
function Unknown({ navigate }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-farhat/5 grid place-items-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round"
             className="w-6 h-6 text-farhat" aria-hidden="true">
          <path d="M9 14l-4-4 4-4" />
          <path d="M5 10h9a5 5 0 0 1 0 10h-1" />
        </svg>
      </div>

      <h1 className="mt-4 text-lg font-bold">Payment not completed</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-body">
        Nothing was taken. Your order is still here — pick up where you
        left off.
      </p>

      <button
        onClick={() => navigate('/checkout')}
        className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm
                   font-semibold hover:opacity-90 transition-opacity"
      >
        Back to my order
      </button>

      <p className="mt-4 text-xs text-body">
        Trouble paying? Call us on{' '}
        <a href="tel:0300000000" className="font-semibold text-farhat">
          030 000 0000
        </a>
      </p>
    </div>
  )
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
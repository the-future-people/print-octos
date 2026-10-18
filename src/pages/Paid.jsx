import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPayment } from '../api/client'
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
  // Opened in Paystack's panel from the app: hand straight back to it.
  const handBack = params.get('from') === 'app' && !window.Capacitor?.isNativePlatform?.()
  // The customer closed the panel themselves: paid, or changed their mind.
  const closed = params.get('closed') === '1'

  useEffect(() => {
    document.title = 'Payment — Farhat Printing Press'
  }, [])

  useEffect(() => {
    if (!reference) {
      setState('unknown')
      return
    }

    let live = true

    // Asked of the server, not the browser. A cart that has been
    // cleared, a tab opened on another device, or a reload an hour
    // later all have to show the same thing — and the reference in
    // the address is enough to show it.
    async function ask() {
      if (!live) return

      try {
        const { data } = await confirmPayment(reference)
        setOrder(data)
        setState('paid')
        return
      } catch {
        // Not confirmed yet. Paystack posts to us at the same moment
        // it redirects them, so the two race and the answer is often
        // a second behind.
      }

      // A closed panel is either a payment still landing or one never
      // made. Saying "not paid" could make someone pay twice, so after a
      // short look it says honestly that it cannot tell yet.
      if (closed && Date.now() - started.current > 6_000) {
        setState('unsure')
        return
      }
      if (Date.now() - started.current > GIVE_UP_AFTER) {
        setState('slow')
        return
      }

      setTimeout(ask, ASK_EVERY)
    }

    ask()
    return () => { live = false }
  }, [reference])

  // Nothing moves on its own. Moving somebody automatically goes
  // wrong in ways nobody sees until they reload — and this is the one
  // page where being stranded costs the most trust.
  //
  // The cart is cleared the moment we know it is paid, though: a paid
  // order has stopped being a cart, and the next thing they order
  // should start a new one rather than join work already on the floor.
  useEffect(() => {
    if (state === 'paid') cart.forget()
  }, [state, cart])

  if (handBack) return <BackToApp reference={reference} />

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-5">
        {state === 'checking' && <Checking />}
        {state === 'unsure' && <Unsure navigate={navigate} />}
        {state === 'paid' && (
          <Done order={order} saved={saved} navigate={navigate} />
        )}
        {state === 'slow' && <Slow saved={saved} navigate={navigate} />}
        {state === 'unknown' && <Unknown navigate={navigate} />}
        {state === 'done-already' && <AlreadyDone navigate={navigate} />}
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
 * They have been here before — paid, shown, and moved on. A reload
 * lands back on this URL with the cart long since cleared.
 *
 * Not a failure, and not a celebration either: just a way back to
 * something useful.
 */
/**
 * What a customer sees once the money has landed.
 *
 * The end of the journey rather than a step on the way to one, so it
 * carries everything they would otherwise have to go looking for: the
 * amount, where to collect, when it will be ready, and the link that
 * opens their order later.
 *
 * The link is here because the text message can be slow. A customer
 * who can copy it now never has to wait for one, and one who misses
 * it entirely still has the number to quote on the phone.
 */
function Done({ order, saved, navigate }) {
  const [copied, setCopied] = useState(false)

  const link = order?.short_code
    ? `print-octos.vercel.app/t/${order.short_code}`
    : null

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(`https://${link}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused, and there is nothing useful
      // to say about it — the link is on screen to be read either way.
    }
  }

  return (
    <div className="py-14 text-center">
      <svg viewBox="0 0 64 64" className="w-16 h-16 mx-auto" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="none" stroke="#047857"
                strokeWidth="3.5" strokeLinecap="round"
                transform="rotate(-90 32 32)"
                className="[stroke-dasharray:170]
                           animate-[draw-ring_700ms_ease-out_forwards]" />
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
          <div className="mt-5 rounded-xl border border-rule bg-substrate/40
                          px-4 py-3.5 text-left">
            <p className="text-xs text-body">Collect at</p>
            <p className="mt-0.5 text-[0.95rem] font-semibold">
              {order.branch.name}
            </p>
            {order.branch.address && (
              <p className="mt-0.5 text-xs text-body">{order.branch.address}</p>
            )}
            {order.promised_for && (
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                Ready about {readyLabel(order.promised_for)}
              </p>
            )}

            {link && (
              <div className="mt-3.5 pt-3.5 border-t border-rule">
                <p className="text-xs text-body">Your tracking link</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 min-w-0 text-xs break-all">
                    {link}
                  </code>
                  <button
                    onClick={copy}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5
                               rounded-md border border-rule text-xs font-semibold
                               hover:border-ink transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.4" strokeLinecap="round"
                             strokeLinejoin="round" className="w-3.5 h-3.5
                             text-emerald-700" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="1.7" strokeLinecap="round"
                             strokeLinejoin="round" className="w-3.5 h-3.5"
                             aria-hidden="true">
                          <rect x="9" y="9" width="12" height="12" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            if (saved) {
              navigate(`/track/${saved.order_number}?t=${saved.access_token}`)
            } else if (order?.short_code) {
              navigate(`/t/${order.short_code}`)
            }
          }}
          className="mt-5 w-full px-5 py-3 rounded-lg bg-farhat text-white text-sm
                     font-semibold hover:opacity-90 transition-opacity"
        >
          See my order
        </button>

        <p className="mt-3 text-xs text-body">
          We’re texting this link to you as well.
        </p>
      </div>
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


function BackToApp({ reference }) {
  const link = `printoctos://paid?reference=${encodeURIComponent(reference || '')}`
  useEffect(() => { window.location.href = link }, [link])
  return (
    <div className="min-h-screen grid place-items-center px-8 text-center">
      <div>
        <p className="text-[0.95rem] font-semibold">Taking you back to Print Octos…</p>
        <a href={link} className="mt-4 inline-block px-5 py-2.5 rounded-lg bg-farhat
                                  text-white text-sm font-semibold">
          Return to the app
        </a>
      </div>
    </div>
  )
}

function Unsure({ navigate }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-lg font-bold">We couldn’t confirm a payment yet</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-body">
        If you completed it, it will show in a moment and we’ll text you.
        If you didn’t, nothing was taken and your order is still here.
      </p>
      <div className="mt-5 flex gap-2 justify-center">
        <button onClick={() => window.location.reload()}
                className="px-4 py-2.5 rounded-lg border border-ink text-sm font-semibold">
          Check again
        </button>
        <button onClick={() => navigate('/checkout')}
                className="px-4 py-2.5 rounded-lg bg-farhat text-white text-sm font-semibold">
          Back to my order
        </button>
      </div>
    </div>
  )
}
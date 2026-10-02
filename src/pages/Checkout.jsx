import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { loadOrder } from '../lib/order'
import logo from '../assets/farhat-logo.png'
import { getOrder, getFile, identify, setCode, startPayment } from '../api/client'
import SwipeToPay from '../components/SwipeToPay.jsx'

/**
 * PLACEHOLDER. Nothing computes this yet.
 *
 * A real estimate needs a turnaround figure per service and the floor's
 * current load — routing and capacity are not built. This exists so the
 * screen can be judged as it will look, and must be replaced before any
 * customer sees it: a time someone plans their day around is the worst
 * thing to invent.
 */
function estimatedReady() {
  const minutes = 150
  const at = new Date(Date.now() + minutes * 60_000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return {
    duration: rest
      ? `${hours} hour${hours === 1 ? '' : 's'} ${rest} minutes`
      : `${hours} hour${hours === 1 ? '' : 's'}`,
    clock: at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}
/**
 * The last screen before paying.
 *
 * One page rather than three. The order is small, and a customer who
 * can see the whole thing knows how much is left to do.
 *
 * The sections unlock in order because they depend on each other: a
 * code belongs to a person, so it cannot be offered before we know who
 * they are, and nothing can be paid for until both are settled.
 *
 * No promised date. Routing is not built, so any date shown here would
 * be invented — and a date a customer plans around is worse invented
 * than absent.
 */
export default function Checkout() {
  const navigate = useNavigate()
  const saved = loadOrder()

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', saved?.order_number],
    queryFn: () => getOrder(saved.order_number, saved.access_token).then(r => r.data),
    enabled: !!saved,
    retry: false,
  })

  const { data: artwork } = useQuery({
    queryKey: ['order-file', saved?.order_number],
    queryFn: () => getFile(saved.order_number, saved.access_token).then(r => r.data),
    enabled: !!saved,
    retry: false,
  })

  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [code, setCodeInput] = useState('')
  const [who, setWho] = useState(null)
  const [issuedCode, setIssuedCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    document.title = 'Checkout — Farhat Printing Press'
  }, [])

  if (!saved) {
    return (
      <Shell>
        <p className="py-12 text-sm text-body">
          There’s nothing in your order yet.{' '}
          <button onClick={() => navigate('/')}
                  className="font-semibold text-farhat hover:underline">
            Start one
          </button>
        </p>
      </Shell>
    )
  }

  if (isLoading) {
    return <Shell><p className="py-12 text-sm text-body">Loading your order…</p></Shell>
  }

  if (isError || !order) {
    return (
      <Shell>
        <p className="py-12 text-sm text-body">
          We can’t find that order — it may have expired.{' '}
          <button onClick={() => navigate('/')}
                  className="font-semibold text-farhat hover:underline">
            Start again
          </button>
        </p>
      </Shell>
    )
  }

  async function handleIdentify() {
    setBusy(true)
    setProblem('')
    try {
      const { data } = await identify(saved.order_number, saved.access_token, {
        phone: phone.trim(),
        first_name: firstName.trim(),
        ...(code.trim() ? { code: code.trim() } : {}),
      })
      setWho(data)
      await refetch()
    } catch (err) {
      const data = err.response?.data
      if (data?.code_required) {
        // Recognised, and this person chose to protect their history.
        setWho(data)
        setProblem(data.detail || 'Enter your code to carry on.')
      } else {
        setProblem(data?.detail || 'We couldn’t save that. Check the number and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleCode() {
    setBusy(true)
    setProblem('')
    try {
      const { data } = await setCode(saved.order_number, saved.access_token)
      setIssuedCode(data)
      await refetch()
    } catch (err) {
      setProblem(err.response?.data?.detail || 'We couldn’t set a code just now.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePay() {
    setBusy(true)
    setProblem('')
    try {
      const { data } = await startPayment(
        saved.order_number,
        saved.access_token,
        `${window.location.origin}/paid`,
      )
      // Paystack's own page. Cards, mobile money and bank all live
      // there; nothing about the payment happens on ours.
      window.location.href = data.authorization_url
    } catch (err) {
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t start the payment. Try again in a moment.',
      )
      setBusy(false)
    }
  }

  const ready = estimatedReady()
  const identified = who && !who.code_required
  const canPay = identified && Number(order.total) > 0

  return (
    <div className="min-h-screen bg-white text-ink">

      <header className="bg-farhat">
        <div className="bg-black/10">
          <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
            <button onClick={() => navigate(-1)} aria-label="Back"
                    className="shrink-0 text-white/90 hover:text-white text-lg leading-none">
              ←
            </button>
            <div className="flex items-center gap-1.5">
              <img src={logo} alt="" className="h-9 w-auto" aria-hidden="true" />
              <p className="text-base font-bold text-white">
                Farhat<span className="font-normal text-white/85"> Printing Press</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 pb-28">

        <h1 className="mt-7 text-xl font-bold">Your order</h1>

        <section className="mt-4 rounded-xl border border-rule divide-y divide-rule">
          {(order.line_items || []).map((line, i) => (
            <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.95rem] font-medium">{line.service_name}</p>
                <p className="mt-0.5 text-xs text-body">
                  {describe(line)}
                </p>
              </div>
              <p className="shrink-0 text-[0.95rem] tabular-nums">GHS {line.total}</p>
            </div>
          ))}

          {Number(order.discount_amount) > 0 && (
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-body">{order.discount_reason || 'Discount'}</p>
              <p className="text-sm tabular-nums text-farhat">
                − GHS {order.discount_amount}
              </p>
            </div>
          )}

        </section>

        {/* The customer should be able to see their artwork is attached
            before paying for it. Without this the file is something
            they did on a previous screen and have to take on trust. */}
        {artwork && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-rule
                          px-4 py-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              artwork.verdict === 'fine' ? 'bg-emerald-500'
              : artwork.verdict === 'warn' ? 'bg-amber-500'
              : 'bg-farhat'
            }`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{artwork.filename}</p>
              <p className="text-xs text-body">
                {artwork.verdict === 'fine' ? 'Your artwork is attached'
                 : artwork.verdict === 'warn' ? 'Attached, with a note you accepted'
                 : 'We can’t print this file'}
              </p>
            </div>
          </div>
        )}

        {/* ── Who ───────────────────────────────────────────────── */}
        <h2 className="mt-8 text-base font-semibold">How do we reach you?</h2>
        <p className="mt-1 text-sm text-body">
          We’ll text you the moment it’s ready.
        </p>

        <div className="mt-3 flex items-center gap-3 rounded-lg bg-substrate px-3.5 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
               strokeLinecap="round" strokeLinejoin="round"
               className="w-5 h-5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Ready in about {ready.duration}</p>
            <p className="mt-0.5 text-xs text-body">
              That’s around {ready.clock} today
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block mb-1.5 text-xs text-body">Phone number</span>
            <input
              type="tel" inputMode="tel" value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={identified}
              placeholder="024 000 0000"
              className="w-full px-3 py-2.5 rounded-lg border border-rule bg-white
                         text-[0.95rem] disabled:bg-substrate disabled:text-body
                         focus:outline-none focus:border-ink"
            />
          </label>
          <label className="block">
            <span className="block mb-1.5 text-xs text-body">First name</span>
            <input
              type="text" value={firstName}
              onChange={e => setFirstName(e.target.value)}
              disabled={identified}
              placeholder="Ama"
              className="w-full px-3 py-2.5 rounded-lg border border-rule bg-white
                         text-[0.95rem] disabled:bg-substrate disabled:text-body
                         focus:outline-none focus:border-ink"
            />
          </label>
        </div>

        {who?.code_required && (
          <label className="block mt-3">
            <span className="block mb-1.5 text-xs text-body">
              Your code
            </span>
            <input
              type="text" value={code}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="AMA-4K2"
              className="w-full px-3 py-2.5 rounded-lg border border-farhat bg-white
                         text-[0.95rem] tracking-wide focus:outline-none focus:border-ink"
            />
          </label>
        )}

        {!identified && (
          <button
            onClick={handleIdentify}
            disabled={busy || !phone.trim() || !firstName.trim()}
            className="mt-3 w-full px-4 py-3 rounded-lg border border-ink text-[0.95rem]
                       font-semibold disabled:opacity-40 hover:bg-ink hover:text-white
                       transition-colors focus:outline-none focus-visible:ring-2
                       focus-visible:ring-ink"
          >
            {busy ? 'One moment…' : 'Continue'}
          </button>
        )}

        {identified && (
          <p className="mt-3 text-sm text-body">
            {who.returning
              ? `Welcome back, ${who.first_name}.`
              : `Thanks, ${who.first_name}.`}
          </p>
        )}

        {/* ── The code offer ────────────────────────────────────── */}

        {identified && who.discount_available && !issuedCode && (
          <section className="mt-5 rounded-xl bg-farhat/5 border border-farhat/20
                              px-4 py-3.5">
            <p className="text-[0.95rem] font-semibold">
              Save 5% on this order
            </p>
            <p className="mt-1 text-sm leading-relaxed text-body">
              Set up a code and we’ll text it to you. It brings up your past
              orders next time, and takes 5% off today.
            </p>
            <button
              onClick={handleCode}
              disabled={busy}
              className="mt-3 px-4 py-2.5 rounded-lg bg-farhat text-white text-sm
                         font-semibold disabled:opacity-40 hover:opacity-90
                         transition-opacity focus:outline-none focus-visible:ring-2
                         focus-visible:ring-ink"
            >
              {busy ? 'One moment…' : 'Set up my code'}
            </button>
          </section>
        )}

        {issuedCode && (
          <section className="mt-5 rounded-xl border border-rule px-4 py-3.5">
            <p className="text-sm text-body">Your code</p>
            <p className="mt-1 text-2xl font-bold tracking-wide tabular-nums">
              {issuedCode.code}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              Texted to {issuedCode.sent_to}. Keep it — it brings up your past
              orders next time.
            </p>
          </section>
        )}

        {/* ── Where ─────────────────────────────────────────────── */}

        {identified && (
          <>
            <h2 className="mt-8 text-base font-semibold">Collection</h2>
            <div className="mt-3 rounded-xl border border-rule px-4 py-3.5">
              <p className="text-[0.95rem] font-medium">Westland branch</p>
              <p className="mt-1 text-sm text-body">
                We’ll text you the moment it’s ready to collect.
              </p>
            </div>
          </>
        )}

        {problem && (
          <p className="mt-4 text-sm text-farhat">{problem}</p>
        )}

      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-rule">
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="min-w-0">
            {Number(order.discount_amount) > 0 && (
              <p className="text-[0.7rem] text-body line-through tabular-nums">
                GHS {order.full_total}
              </p>
            )}
            <p className="text-xl font-bold tabular-nums">GHS {order.total}</p>
          </div>
          <div className="ml-auto w-[58%] max-w-[260px]">
            <SwipeToPay
              label={busy ? 'One moment…' : 'Swipe to pay'}
              onConfirm={handlePay}
              disabled={!canPay || busy}
              busy={busy}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function describe(line) {
  const spec = line.specifications || {}
  if (spec.width_in && spec.height_in) {
    return `${spec.width_in} × ${spec.height_in} in · ${line.quantity}`
  }
  return `${line.quantity} × GHS ${line.unit_price}`
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="bg-farhat px-5 py-4">
        <p className="max-w-xl mx-auto text-base font-bold text-white">
          Farhat<span className="font-normal text-white/85"> Printing Press</span>
        </p>
      </header>
      <main className="max-w-xl mx-auto px-5">{children}</main>
    </div>
  )
}
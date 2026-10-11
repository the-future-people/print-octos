import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  getOrder, getFile, identify, setCode, startPayment, updateOrder,
} from '../api/client'
import { useCart } from '../lib/CartContext.jsx'
import { useToast } from '../lib/ToastContext.jsx'
import { serviceImage } from '../lib/images'
import SwipeToPay from '../components/SwipeToPay.jsx'
import BranchChoice from '../components/BranchChoice.jsx'
import logo from '../assets/farhat-logo.png'
import Header from '../components/Header.jsx'
/**
 * Finishing an order.
 *
 * The cart is on the left and everything about finishing on the right:
 * who you are, where it is made, what it comes to, and the one
 * irreversible action. Scattering those down a single column is what
 * made the earlier version read as a form rather than a shop.
 *
 * Quantities change here and items can be removed. Sizes cannot — a
 * different size needs the artwork judged again, and that belongs back
 * on the product page where the check lives.
 */
export default function Checkout() {
  const navigate = useNavigate()
  const cart = useCart()
  const toast = useToast()
  const saved = cart.saved

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['order', saved?.order_number],
    queryFn: () => getOrder(saved.order_number, saved.access_token).then(r => r.data),
    enabled: !!saved,
    retry: false,
  })

  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [code, setCodeInput] = useState('')
  const [who, setWho] = useState(null)
  const [issuedCode, setIssuedCode] = useState(null)
  const [branch, setBranch] = useState(null)
  const [busy, setBusy] = useState(false)
  const [working, setWorking] = useState(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    document.title = 'Checkout — Farhat Printing Press'
  }, [])

  // ── Changing the cart ──────────────────────────────────────────

  async function rewrite(lines, note) {
    setWorking(note)
    setProblem('')
    try {
      await updateOrder(saved.order_number, saved.access_token, {
        line_items: lines.map(l => ({
          id: l.id,
          service: l.service,
          quantity: l.quantity,
          specifications: l.specifications,
        })),
      })
      await refetch()
      await cart.refresh()
    } catch (err) {
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t change that just now. Try again in a moment.',
      )
    } finally {
      setWorking(null)
    }
  }

  function changeQuantity(line, by) {
    const next = Math.max(1, Number(line.quantity) + by)
    if (next === Number(line.quantity)) return

    rewrite(
      order.line_items.map(l =>
        l.id === line.id ? { ...l, quantity: next } : l,
      ),
      line.id,
    )
  }

  function remove(line) {
    const left = order.line_items.filter(l => l.id !== line.id)
    rewrite(left, line.id)
    toast.show(`${line.service_name} removed`)
  }

  // ── Who, where, paying ─────────────────────────────────────────

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

  async function handleChooseBranch(option) {
    setBranch(option)
    setProblem('')
    try {
      await updateOrder(saved.order_number, saved.access_token, {
        branch: option.branch_id,
      })
    } catch (err) {
      setBranch(null)
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t set that branch. Try again in a moment.',
      )
    }
  }

  async function handlePay() {
    setBusy(true)
    setProblem('')
    try {
      const { data } = await startPayment(
        saved.order_number, saved.access_token,
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

  // ── Nothing to finish ──────────────────────────────────────────

  if (!saved) return <Empty navigate={navigate} />
  if (isLoading) {
    return <Shell><p className="py-12 text-sm text-body">Loading your order…</p></Shell>
  }
  if (isError || !order) {
    return (
      <Shell>
        <p className="py-12 text-sm text-body">
          We can’t find that order — it may have expired.{' '}
          <button onClick={() => { cart.forget(); navigate('/') }}
                  className="font-semibold text-farhat hover:underline">
            Start again
          </button>
        </p>
      </Shell>
    )
  }

  const lines = order.line_items || []
  if (lines.length === 0) return <Empty navigate={navigate} />

  const identified = who && !who.code_required
  const canPay = identified && branch && Number(order.total) > 0

  return (
    <div className="min-h-screen bg-white text-ink pb-28 lg:pb-12">

      <Header back />

      <main className="max-w-5xl mx-auto px-5 pt-6 lg:flex lg:gap-8 lg:items-start">

        {/* ── The cart ─────────────────────────────────────────── */}

        <section className="lg:flex-1 lg:min-w-0">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-bold">Your order</h1>
            <span className="text-xs text-body">
              {lines.length} item{lines.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-rule divide-y divide-rule">
            {lines.map(line => (
              <CartLine
                key={line.id}
                line={line}
                order={saved}
                busy={working === line.id}
                onStep={by => changeQuantity(line, by)}
                onRemove={() => remove(line)}
              />
            ))}
          </div>

          <button
            onClick={() => navigate('/')}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold
                       text-farhat hover:underline underline-offset-4"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" className="w-4 h-4"
                 aria-hidden="true">
              <path d="M12 6v12M6 12h12" />
            </svg>
            Add another item
          </button>
        </section>

        {/* ── Finishing ────────────────────────────────────────── */}

        <aside className="mt-8 lg:mt-0 lg:w-[360px] shrink-0">
          <div className="rounded-xl border border-rule bg-substrate/40 px-4 py-4">

            <h2 className="text-[0.95rem] font-semibold">How do we reach you?</h2>
            <p className="mt-0.5 text-xs text-body">
              We’ll text you the moment it’s ready.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <input
                type="tel" inputMode="tel" value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={identified}
                placeholder="024 000 0000"
                className="px-3 py-2.5 rounded-lg border border-rule bg-white text-sm
                           disabled:bg-substrate disabled:text-body
                           focus:outline-none focus:border-ink"
              />
              <input
                type="text" value={identified ? who.first_name : firstName}
                onChange={e => setFirstName(e.target.value)}
                disabled={identified}
                placeholder="First name"
                className="px-3 py-2.5 rounded-lg border border-rule bg-white text-sm
                           disabled:bg-substrate disabled:text-body
                           focus:outline-none focus:border-ink"
              />
            </div>

            {who?.code_required && (
              <input
                type="text" value={code}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Your code — AMA-4K2"
                className="mt-2.5 w-full px-3 py-2.5 rounded-lg border border-farhat
                           bg-white text-sm tracking-wide focus:outline-none
                           focus:border-ink"
              />
            )}

            {!identified && (
              <button
                onClick={handleIdentify}
                disabled={busy || !phone.trim() || !firstName.trim()}
                className="mt-2.5 w-full px-4 py-2.5 rounded-lg border border-ink
                           text-sm font-semibold disabled:opacity-40
                           hover:bg-ink hover:text-white transition-colors"
              >
                {busy ? 'One moment…' : 'Continue'}
              </button>
            )}

            {identified && who.discount_available && !issuedCode && (
              <div className="mt-3 rounded-lg bg-farhat/5 border border-farhat/20
                              px-3 py-3">
                <p className="text-sm font-semibold">Save 5% on this order</p>
                <p className="mt-1 text-xs leading-relaxed text-body">
                  Set up a code and we’ll text it to you. It brings up your
                  past orders next time.
                </p>
                <button
                  onClick={handleCode}
                  disabled={busy}
                  className="mt-2.5 w-full px-4 py-2 rounded-lg bg-farhat text-white
                             text-sm font-semibold disabled:opacity-40
                             hover:opacity-90 transition-opacity"
                >
                  {busy ? 'One moment…' : 'Set up my code'}
                </button>
              </div>
            )}

            {issuedCode && (
              <div className="mt-3 rounded-lg border border-rule bg-white px-3 py-3">
                <p className="text-xs text-body">Your code</p>
                <p className="mt-0.5 text-xl font-bold tracking-wide">
                  {issuedCode.code}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-body">
                  Texted to {issuedCode.sent_to}. Keep it.
                </p>
              </div>
            )}

            {identified && (
              <>
                <div className="my-4 border-t border-rule" />
                <h2 className="text-[0.95rem] font-semibold">Where and when</h2>
                <BranchChoice
                  order={saved}
                  chosen={branch?.branch_id}
                  onChoose={handleChooseBranch}
                />
              </>
            )}

            <div className="my-4 border-t border-rule" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-body">Items</span>
              <span className="tabular-nums">GHS {order.full_total ?? order.total}</span>
            </div>

            {Number(order.discount_amount) > 0 && (
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-emerald-700">{order.discount_reason}</span>
                <span className="tabular-nums text-emerald-700">
                  − GHS {order.discount_amount}
                </span>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-rule flex items-baseline
                            justify-between">
              <span className="text-[0.95rem] font-semibold">Total</span>
              <span className="text-2xl font-extrabold tabular-nums">
                GHS {order.total}
              </span>
            </div>

            {problem && (
              <p className="mt-3 text-sm text-farhat">{problem}</p>
            )}

            {/* On a wide screen the swipe lives here, with the money it
                is about. On a phone it is pinned to the bottom instead,
                so the total and the action follow the customer down a
                long cart. */}
            <div className="mt-4 hidden lg:block">
              <SwipeToPay
                label="Swipe to pay"
                amount={order.total}
                onConfirm={handlePay}
                disabled={!canPay || busy}
                busy={busy}
              />
              <p className="mt-2 text-xs text-center text-body">
                We’ll text you when it’s ready to collect.
              </p>
            </div>
          </div>
        </aside>
      </main>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-rule
                      px-5 py-3">
        <SwipeToPay
          label="Swipe to pay"
          amount={order.total}
          onConfirm={handlePay}
          disabled={!canPay || busy}
          busy={busy}
        />
      </div>
    </div>
  )
}

/**
 * One item in the cart, with its artwork.
 *
 * The file travels with the line because that is where it belongs — a
 * banner's artwork is not the flyer's, and a customer looking at three
 * items needs to see which file goes with which.
 */
function CartLine({ line, order, busy, onStep, onRemove }) {
  const { data: artwork } = useQuery({
    queryKey: ['order-file', order.order_number, line.id],
    queryFn: () =>
      getFile(order.order_number, order.access_token, line.id).then(r => r.data),
    retry: false,
  })

  const photo = serviceImage(line.service_name)
  const spec = line.specifications || {}
  const size = spec.width_in && spec.height_in
    ? `${spec.width_in} × ${spec.height_in} in`
    : null

  return (
    <div className={`px-3 py-3 flex gap-3 transition-opacity ${busy ? 'opacity-50' : ''}`}>
      {photo ? (
        <img src={photo} alt="" className="w-14 h-14 rounded-lg object-cover
                                           border border-rule shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-substrate border border-rule
                        shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">{line.service_name}</p>
          <button
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${line.service_name}`}
            className="shrink-0 text-body/60 hover:text-farhat transition-colors
                       disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {size && <p className="mt-0.5 text-xs text-body">{size}</p>}

        {artwork && <ArtworkLine artwork={artwork} />}

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <button onClick={() => onStep(-1)} disabled={busy} aria-label="Fewer"
                    className="w-7 h-7 rounded-md border border-rule text-sm
                               hover:border-ink disabled:opacity-40 transition-colors">
              −
            </button>
            <span className="text-sm font-semibold tabular-nums min-w-[2ch]
                             text-center">
              {line.quantity}
            </span>
            <button onClick={() => onStep(1)} disabled={busy} aria-label="More"
                    className="w-7 h-7 rounded-md border border-rule text-sm
                               hover:border-ink disabled:opacity-40 transition-colors">
              +
            </button>
          </div>

          <p className="text-sm font-bold tabular-nums">GHS {line.total}</p>
        </div>
      </div>
    </div>
  )
}

function ArtworkLine({ artwork }) {
  const tone = {
    fine: { colour: 'text-emerald-700', note: 'good to print' },
    warn: { colour: 'text-amber-700', note: 'prints a little soft' },
    refuse: { colour: 'text-farhat', note: 'we can’t print this' },
  }[artwork.verdict]

  if (!tone) return null

  return (
    <p className={`mt-1 flex items-center gap-1.5 text-xs ${tone.colour}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0"
           aria-hidden="true">
        {artwork.verdict === 'fine' ? (
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 7.2l-6.1 6.9a1 1 0 0 1-1.5 0L6 12.6a1 1 0 0 1 1.5-1.3l2.6 2.9 5.4-6.1A1 1 0 0 1 17 9.2z" />
        ) : (
          <path d="M12.9 3.6l8.3 14.4a1 1 0 0 1-.9 1.5H3.7a1 1 0 0 1-.9-1.5l8.3-14.4a1 1 0 0 1 1.8 0zM12 8a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0V9a1 1 0 0 0-1-1zm0 8.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" />
        )}
      </svg>
      <span className="truncate">{artwork.filename} · {tone.note}</span>
    </p>
  )
}

function Empty({ navigate }) {
  return (
    <Shell>
      <div className="py-16 text-center">
        <p className="text-base font-semibold">Nothing in your order yet</p>
        <p className="mt-1 text-sm text-body">
          Pick something to print and it’ll show up here.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-5 px-5 py-2.5 rounded-lg bg-farhat text-white text-sm
                     font-semibold hover:opacity-90 transition-opacity"
        >
          See what we print
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="bg-farhat px-5 py-4">
        <p className="max-w-5xl mx-auto text-base font-bold text-white">
          Farhat<span className="font-normal text-white/85"> Printing Press</span>
        </p>
      </header>
      <main className="max-w-5xl mx-auto px-5">{children}</main>
    </div>
  )
}
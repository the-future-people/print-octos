import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCatalogue, createOrder, updateOrder } from '../api/client'
import { loadOrder, saveOrder } from '../lib/order'

/**
 * What the customer is ordering, and what it costs.
 *
 * The fields come from the service's own spec_template, so adding a
 * service never means editing this page. The price comes from the
 * server every time: the browser does no pricing arithmetic, because
 * two implementations of one calculation always drift apart.
 *
 * An order is created the moment this page opens, before anyone has
 * agreed to anything. Most are abandoned here and that costs nothing —
 * an unfinished order expires on its own.
 */
export default function Specify() {
  const { serviceId } = useParams()
  const navigate = useNavigate()

  const { data: services = [], isLoading: loadingCatalogue } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const service = services.find(s => String(s.id) === String(serviceId))

  const [order, setOrder] = useState(() => loadOrder())
  const [values, setValues] = useState({})
  const [quantity, setQuantity] = useState(1)
  const [quote, setQuote] = useState(null)
  const [pricing, setPricing] = useState(false)
  const [problem, setProblem] = useState('')

  // The spec's own fields, minus quantity — that has its own control
  // below, and one number held in two places is how a job gets
  // charged for a single page when the customer asked for ten.
  const fields = useMemo(
    () => (service?.spec_template || []).filter(f => f.key !== 'quantity'),
    [service],
  )

  useEffect(() => {
    if (!service) return
    setValues(
      Object.fromEntries(
        (service.spec_template || [])
          .filter(f => f.key !== 'quantity')
          .map(f => [f.key, f.default ?? '']),
      ),
    )
    const q = (service.spec_template || []).find(f => f.key === 'quantity')
    setQuantity(q?.default ?? 1)
  }, [service])

  // An order to hang the line on. Created once and remembered, so a
  // refresh does not start a second one.
  useEffect(() => {
    if (order) return
    createOrder()
      .then(r => {
        saveOrder(r.data)
        setOrder(r.data)
      })
      .catch(() => setProblem('We could not start your order. Refresh to try again.'))
  }, [order])

  // Priced after a pause rather than on every keystroke. One call when
  // they stop typing, not one per digit.
  useEffect(() => {
    if (!order || !service) return
    const ready = fields.every(f => !f.required || values[f.key] !== '')
    if (!ready) return

    const timer = setTimeout(() => {
      setPricing(true)
      setProblem('')
      updateOrder(order.order_number, order.access_token, {
        line_items: [{
          service: service.id,
          quantity: Number(quantity) || 1,
          specifications: values,
        }],
      })
        .then(r => setQuote(r.data))
        .catch(err => {
          setQuote(null)
          setProblem(
            err.response?.data?.detail ||
            'We could not price that. Check the sizes and try again.',
          )
        })
        .finally(() => setPricing(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [order, service, values, quantity, fields])

  const line = quote?.line_items?.[0]

  function setField(key, raw) {
    // Raw while typing. Clamping on every keystroke turns the first
    // digit of 168 into a 6.
    setValues(v => ({ ...v, [key]: raw === '' ? '' : Number(raw) }))
  }

  function clampField(field, raw) {
    const min = field.min ?? 1
    const n = Math.max(min, Number(raw) || min)
    setValues(v => ({ ...v, [field.key]: n }))
  }

  if (loadingCatalogue) {
    return <Shell><p className="py-10 text-sm text-body">Loading…</p></Shell>
  }

  if (!service) {
    return (
      <Shell>
        <p className="py-10 text-sm text-body">
          We can’t find that service.{' '}
          <button onClick={() => navigate('/')}
                  className="text-farhat font-semibold hover:underline">
            Start again
          </button>
        </p>
      </Shell>
    )
  }

  return (
    <div className="min-h-screen bg-white text-ink">

      <header className="bg-farhat px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Back"
            className="shrink-0 text-white/90 hover:text-white text-lg leading-none"
          >
            ←
          </button>
          <p className="text-base font-bold text-white">
            Farhat<span className="font-normal text-white/85"> Printing Press</span>
          </p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 pb-28">

        {/* The name sits with the fields it describes, not in the bar.
            What the customer is specifying should be in the same breath
            as the boxes they are filling in. */}
        <div className="mt-6 pb-4 border-b border-rule">
          <h1 className="text-lg font-bold">{service.name}</h1>
          <p className="mt-1 text-sm leading-relaxed text-body">
            {service.description}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {fields.map(field => (
            <label key={field.key} className="block">
              <span className="block mb-1.5 text-xs text-body">
                {field.label}{field.unit ? ` (${field.unit})` : ''}
              </span>
              {field.type === 'select' ? (
                <select
                  value={values[field.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-rule bg-white
                             text-[0.95rem] focus:outline-none focus:border-ink"
                >
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  inputMode="numeric"
                  min={field.min ?? 1}
                  max={field.max}
                  value={values[field.key] ?? ''}
                  onChange={e => setField(field.key, e.target.value)}
                  onBlur={e => clampField(field, e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-rule bg-white
                             text-[0.95rem] tabular-nums focus:outline-none focus:border-ink"
                />
              )}
            </label>
          ))}
        </div>

        <div className="mt-4">
          <span className="block mb-1.5 text-xs text-body">How many?</span>
          <div className="inline-flex items-center gap-3">
            <button
              onClick={() => setQuantity(q => Math.max(1, Number(q) - 1))}
              aria-label="One fewer"
              className="w-10 h-10 rounded-lg border border-rule text-lg
                         hover:border-ink focus:outline-none focus-visible:ring-2
                         focus-visible:ring-ink"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 px-2 py-2.5 text-center rounded-lg border border-rule
                         text-[0.95rem] tabular-nums focus:outline-none focus:border-ink"
            />
            <button
              onClick={() => setQuantity(q => Number(q) + 1)}
              aria-label="One more"
              className="w-10 h-10 rounded-lg border border-rule text-lg
                         hover:border-ink focus:outline-none focus-visible:ring-2
                         focus-visible:ring-ink"
            >
              +
            </button>
          </div>
        </div>

        {problem && (
          <p className="mt-4 text-sm text-farhat">{problem}</p>
        )}

        {line?.minimum_applied && (
          <p className="mt-4 rounded-lg bg-substrate px-3 py-2.5 text-xs leading-relaxed text-body">
            This size is below our minimum, so each piece is charged at
            the minimum rate.
          </p>
        )}

      </main>

      {/* The price stays in view while the sizes change above it. */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-rule">
        <div className="max-w-xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="min-w-0">
            {line && (
              <p className="text-[0.7rem] text-body truncate">
                {line.quantity} × GHS {line.unit_price}
              </p>
            )}
            <p
              className="text-xl font-bold tabular-nums transition-opacity"
              style={{ opacity: pricing ? 0.45 : 1 }}
            >
              {quote ? `GHS ${quote.total}` : '—'}
            </p>
          </div>
          <button
            disabled={!quote || Number(quote.total) <= 0}
            onClick={() => navigate('/checkout')}
            className="ml-auto shrink-0 px-5 py-3 rounded-lg bg-farhat text-white
                       text-[0.95rem] font-semibold disabled:opacity-40
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
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
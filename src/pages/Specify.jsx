import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCatalogue, createOrder, updateOrder, getFile,getOrder} from '../api/client'
import { loadOrder, saveOrder } from '../lib/order'
import { serviceImage } from '../lib/images'
import ArtworkUpload from '../components/ArtworkUpload.jsx'
import logo from '../assets/farhat-logo.png'

/**
 * What the customer is ordering, and what it costs.
 *
 * Artwork first, then the size. Most people start from a file they
 * already have, and asking for dimensions before seeing it puts the
 * abstract question first. The resolution check still needs both, so
 * it waits quietly until the size is there and re-runs when it moves.
 *
 * The photograph sits beside the inputs rather than on a screen of its
 * own. Seeing what you are buying while you size it is the cheapest
 * moment to catch a mistake, and it costs no extra step.
 *
 * The price sits with the controls that change it rather than pinned
 * to the bottom of the window, so the number moves where the customer
 * is already looking.
 *
 * An order is created the moment this page opens, before anyone has
 * agreed to anything. Most are abandoned here and that costs nothing.
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
  const [fileResult, setFileResult] = useState(null)

  // The spec's own fields, minus quantity — that has its own control
  // below, and one number held in two places is how a job gets charged
  // for a single page when the customer asked for ten.
  const fields = useMemo(
    () => (service?.spec_template || []).filter(f => f.key !== 'quantity'),
    [service],
  )

  const byArea = service?.unit === 'PER_SQFT' || service?.unit === 'PER_SQCM'

  // Starting values from the template. The rehydrate below overwrites
  // these when the order already has a line — a customer coming back
  // should see what they typed, not the blank form again.
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

  useEffect(() => {
    if (order) return
    createOrder()
      .then(r => {
        saveOrder(r.data)
        setOrder(r.data)
      })
      .catch(() => setProblem('We could not start your order. Refresh to try again.'))
  }, [order])

  // Everything the customer did is on the server. Coming back to this
  // page with an order already in hand should show their work, not a
  // blank form — the file they sent, the size they typed. Without this
  // a step backwards looks like a step lost.
  useEffect(() => {
    if (!order || !service) return

    getOrder(order.order_number, order.access_token)
      .then(({ data }) => {
        const line = (data.line_items || []).find(
          l => String(l.service) === String(service.id),
        )
        if (!line) return

        setValues(line.specifications || {})
        setQuantity(line.quantity || 1)
        setQuote(data)
      })
      .catch(() => {})

    getFile(order.order_number, order.access_token)
      .then(({ data }) => setFileResult(data))
      .catch(() => {})
  }, [order, service])

  // Priced after a pause rather than on every keystroke.
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
        .then(r => {
          setQuote(r.data)
          // The size has moved, so the verdict may have. A file that
          // was fine on a small print is refused across six feet.
          if (fileResult) {
            getFile(order.order_number, order.access_token)
              .then(f => setFileResult(f.data))
              .catch(() => {})
          }
        })
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
    // An empty field stays empty. Filling it with the minimum on blur
    // would put a number there the customer never chose — which is the
    // whole reason the defaults were removed.
    if (raw === '' || raw === null) {
      setValues(v => ({ ...v, [field.key]: '' }))
      return
    }
    const min = field.min ?? 1
    const n = Math.max(min, Number(raw) || min)
    setValues(v => ({ ...v, [field.key]: n }))
  }

  if (loadingCatalogue) {
    return <Shell><p className="py-12 text-sm text-body">Loading…</p></Shell>
  }

  if (!service) {
    return (
      <Shell>
        <p className="py-12 text-sm text-body">
          We can’t find that service.{' '}
          <button onClick={() => navigate('/')}
                  className="font-semibold text-farhat hover:underline">
            Start again
          </button>
        </p>
      </Shell>
    )
  }

  const photo = serviceImage(service.name)
  const needsFile = service.requires_file_upload

  const canContinue =
    !!quote && Number(quote.total) > 0 && artworkReady(service, fileResult)

  // The button says what is missing rather than sitting mute and grey.
  // A disabled control that explains nothing is a dead end.
  const sizeMissing = fields.some(
    f => f.required && (values[f.key] === '' || values[f.key] == null),
  )

  const continueLabel =
    sizeMissing ? 'Enter the size to continue'
    : !quote ? 'Continue'
    : needsFile && !fileResult ? 'Upload artwork to continue'
    : needsFile && fileResult?.verdict === 'refuse' ? 'Send different artwork'
    : needsFile && fileResult?.verdict === 'warn' && !fileResult.warning_accepted
      ? 'Accept the note to continue'
    : 'Continue'

  return (
    <div className="min-h-screen bg-white text-ink">

      <header className="bg-farhat">
        <div className="bg-black/10">
          <div className="max-w-4xl mx-auto px-5 py-4 flex items-center gap-3">
            <button onClick={() => navigate('/')} aria-label="Back"
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

      <main className="max-w-4xl mx-auto px-5 pb-12">

        <div className="mt-6 sm:flex sm:gap-5 lg:gap-8">

          {/* The photo shrinks as the screen does. On a phone it is a
              thumbnail beside the title: the customer came to order
              something, and a full-width picture would push the whole
              form below the fold to confirm what they just tapped. */}
          <div className="flex gap-3 sm:block sm:w-[150px] lg:w-[200px] shrink-0">
            {photo ? (
              <img src={photo} alt={service.name}
                   className="w-20 h-20 sm:w-full sm:h-auto sm:aspect-[4/3]
                              object-cover rounded-xl border border-rule shrink-0" />
            ) : (
              <div className="w-20 h-20 sm:w-full sm:aspect-[4/3] rounded-xl
                              bg-substrate border border-rule shrink-0" />
            )}

            <div className="min-w-0 sm:hidden">
              <h1 className="text-lg font-bold leading-tight">{service.name}</h1>
              <p className="mt-1 text-xs leading-snug text-body line-clamp-3">
                {service.description}
              </p>
            </div>
          </div>

          <div className="mt-4 sm:mt-0 sm:flex-1 sm:min-w-0">

            <div className="hidden sm:block">
              <h1 className="text-xl lg:text-2xl font-bold">{service.name}</h1>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {service.description}
              </p>
            </div>

            {/* ── The artwork, first ───────────────────────────── */}

            {needsFile && (
              <ArtworkUpload
                order={order}
                result={fileResult}
                onResult={setFileResult}
              />
            )}

            {/* ── Then the size ────────────────────────────────── */}

            <div className="mt-5 pt-5 border-t border-rule">
              <p className="flex items-center gap-2 text-[0.95rem] font-semibold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                     className="w-4 h-4 text-farhat" aria-hidden="true">
                  <path d="M3 9h18v6H3z" />
                  <path d="M7 9v3M11 9v3M15 9v3M19 9v3" />
                </svg>
                How big?
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
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
                        type="number" inputMode="numeric"
                        min={field.min ?? 1} max={field.max}
                        placeholder={field.placeholder || ''}
                        value={values[field.key] ?? ''}
                        onChange={e => setField(field.key, e.target.value)}
                        onBlur={e => clampField(field, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg border border-rule bg-white
                                   text-[0.95rem] tabular-nums placeholder:text-body/40
                                   placeholder:font-normal focus:outline-none
                                   focus:border-ink"
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <span className="block mb-1.5 text-xs text-body">How many?</span>
                <div className="inline-flex items-center gap-3">
                  <button onClick={() => setQuantity(q => Math.max(1, Number(q) - 1))}
                          aria-label="One fewer"
                          className="w-10 h-10 rounded-lg border border-rule text-lg
                                     hover:border-ink focus:outline-none
                                     focus-visible:ring-2 focus-visible:ring-ink">
                    −
                  </button>
                  <input
                    type="number" inputMode="numeric" min="1" value={quantity}
                    onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 px-2 py-2.5 text-center rounded-lg border border-rule
                               text-[0.95rem] tabular-nums focus:outline-none focus:border-ink"
                  />
                  <button onClick={() => setQuantity(q => Number(q) + 1)}
                          aria-label="One more"
                          className="w-10 h-10 rounded-lg border border-rule text-lg
                                     hover:border-ink focus:outline-none
                                     focus-visible:ring-2 focus-visible:ring-ink">
                    +
                  </button>
                </div>
              </div>

              {/* Only where the size is the customer's own number. A
                  business card has a size we set, and warning about it
                  would be noise. */}
              {byArea && (
                <p className="mt-3 text-xs leading-relaxed text-body">
                  Printed to the exact size you enter — please check your
                  measurements.
                </p>
              )}
            </div>

            {problem && (
              <p className="mt-4 text-sm text-farhat">{problem}</p>
            )}

            {line?.minimum_applied && (
              <p className="mt-4 rounded-lg bg-substrate px-3.5 py-3 text-xs
                            leading-relaxed text-body">
                This size is below our minimum, so each piece is charged at the
                minimum rate.
              </p>
            )}

            {/* ── What it comes to ─────────────────────────────── */}

            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl
                            border border-rule bg-substrate/40 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[0.7rem] text-body">
                  {line
                    ? `${describeLine(line)} · ${line.quantity} piece${line.quantity === 1 ? '' : 's'}`
                    : 'Set a size to see the price'}
                </p>
                <p className="text-xl font-extrabold tabular-nums transition-opacity"
                   style={{ opacity: pricing ? 0.45 : 1 }}>
                  {quote ? `GHS ${quote.total}` : '—'}
                </p>
              </div>
              <button
                disabled={!canContinue}
                onClick={() => navigate('/checkout')}
                className={`shrink-0 inline-flex items-center gap-2 px-5 py-2.5
                            rounded-lg text-sm font-semibold transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-ink
                            ${canContinue
                              ? 'bg-farhat text-white hover:opacity-90'
                              : 'bg-substrate text-body/70 cursor-not-allowed'}`}
              >
                {continueLabel}
                {canContinue && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                       className="w-4 h-4" aria-hidden="true">
                    <path d="M5 12h13" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Mirrors the rule the server enforces at payment. Checked here too so
 * the customer is stopped at the step that can fix it, rather than two
 * screens later with no idea what went wrong.
 */
function artworkReady(service, result) {
  if (!service.requires_file_upload) return true
  if (!result) return false
  if (result.verdict === 'refuse') return false
  if (result.verdict === 'warn' && !result.warning_accepted) return false
  return true
}

function describeLine(line) {
  const spec = line.specifications || {}
  if (spec.width_in && spec.height_in) {
    const area = (Number(spec.width_in) * Number(spec.height_in)) / 144
    return `${area.toFixed(1)} sq ft`
  }
  return `GHS ${line.unit_price} each`
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="bg-farhat px-5 py-4">
        <p className="max-w-4xl mx-auto text-base font-bold text-white">
          Farhat<span className="font-normal text-white/85"> Printing Press</span>
        </p>
      </header>
      <main className="max-w-4xl mx-auto px-5">{children}</main>
    </div>
  )
}
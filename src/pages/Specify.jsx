import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCatalogue, createOrder, updateOrder, getFile, getOrder } from '../api/client'
import { loadOrder, saveOrder } from '../lib/order'
import { serviceImage } from '../lib/images'
import ArtworkUpload from '../components/ArtworkUpload.jsx'
import logo from '../assets/farhat-logo.png'

/**
 * What the customer is ordering, and what it costs.
 *
 * Size first, then the artwork. An order can hold a banner and flyers
 * at once, so a file belongs to a line rather than to the order — and
 * the line does not exist until there is something to price. The size
 * is what brings it into being.
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
  const [params] = useSearchParams()

  // Which line this page is editing. Absent from the catalogue, which
  // means a new item — two banners at different sizes are two lines,
  // not one overwritten twice. Present when the cart sends you back to
  // something you already configured.
  const editingId = params.get('line') || null

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

  // The id the server gave this line on its first price. Held so later
  // repricings update it rather than adding another.
  const [workingId, setWorkingId] = useState(null)

  // What else is already on the order — a banner configured earlier,
  // say. The PATCH replaces the whole list, so these have to travel
  // with every reprice or they are deleted.
  const [otherLines, setOtherLines] = useState([])

  // Whether the order has been read back from the server yet. Pricing
  // before it lands would send a list missing everything already in
  // the cart, and the PATCH would delete those items.
  const [loaded, setLoaded] = useState(false)

  // A copy of otherLines the pricing effect can read without listing it
  // as a dependency. Listing it restarts the effect every time the
  // array is rebuilt — a new array is a new value even with identical
  // contents — and the restart cancels the timer before it fires.
  const otherLinesRef = useRef([])
  useEffect(() => { otherLinesRef.current = otherLines }, [otherLines])

  // The spec's own fields, minus quantity — that has its own control
  // below, and one number held in two places is how a job gets charged
  // for a single page when the customer asked for ten.
  const fields = useMemo(
    () => (service?.spec_template || []).filter(f => f.key !== 'quantity'),
    [service],
  )

  const byArea = service?.unit === 'PER_SQFT' || service?.unit === 'PER_SQCM'

  // Starting values from the template. The rehydrate below overwrites
  // these when the order already has this line.
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
    setWorkingId(null)
    setQuote(null)
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
  // page should show their work, not a blank form.
  useEffect(() => {
    if (!order || !service) return
    setLoaded(false)
    setFileResult(null)

    getOrder(order.order_number, order.access_token)
      .then(({ data }) => {
        const all = data.line_items || []

        // Editing a line the cart sent us to, or starting a new one.
        // Without an id every banner would be the same banner.
        const mine = editingId ? all.find(l => l.id === editingId) : null

        setOtherLines(all.filter(l => l.id !== mine?.id))
        otherLinesRef.current = all.filter(l => l.id !== mine?.id)

        if (!mine) return

        setValues(mine.specifications || {})
        setQuantity(mine.quantity || 1)
        setWorkingId(mine.id)
        setQuote(data)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [order, service, editingId])

  // Priced after a pause rather than on every keystroke.
  useEffect(() => {
    if (!order || !service || !loaded) return

    const ready = fields.every(f => !f.required || values[f.key] !== '')
    if (!ready) return

    const currentId = editingId || workingId

    const timer = setTimeout(() => {
      setPricing(true)
      setProblem('')

      updateOrder(order.order_number, order.access_token, {
        // Every line, not just this one. The list replaces what is on
        // the order, so leaving the others out would delete them.
        line_items: [
          ...otherLinesRef.current.map(l => ({
            id: l.id,
            service: l.service,
            quantity: l.quantity,
            specifications: l.specifications,
          })),
          {
            ...(currentId ? { id: currentId } : {}),
            service: service.id,
            quantity: Number(quantity) || 1,
            specifications: values,
          },
        ],
      })
        .then(r => {
          setQuote(r.data)

          if (!currentId) {
            const known = otherLinesRef.current.map(l => l.id)
            const added = (r.data.line_items || []).find(
              l => !known.includes(l.id),
            )
            if (added) {
              setWorkingId(added.id)
              // Into the address bar, so a reload — or a resize, which
              // reloads in dev — comes back to this same item rather
              // than starting another. Replace, not push, so Back
              // still goes to the catalogue.
              navigate(
                `/service/${service.id}?line=${added.id}`,
                { replace: true },
              )
            }
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
  }, [order, service, values, quantity, fields, editingId, workingId, loaded])

  // The line this page is working on.
  const line = (quote?.line_items || []).find(
    l => l.id === (editingId || workingId),
  )

  // The file belongs to a line, so it can only be fetched once the
  // line exists — and re-fetched when the size moves, since a file
  // fine on a small print is refused across six feet.
  useEffect(() => {
    if (!order || !line?.id) return
    getFile(order.order_number, order.access_token, line.id)
      .then(({ data }) => setFileResult(data))
      .catch(() => setFileResult(null))
  }, [order, line?.id, line?.total])

  function setField(key, raw) {
    // Raw while typing. Clamping on every keystroke turns the first
    // digit of 168 into a 6.
    setValues(v => ({ ...v, [key]: raw === '' ? '' : Number(raw) }))
  }

  function clampField(field, raw) {
    // An empty field stays empty. Filling it with the minimum on blur
    // would put a number there the customer never chose.
    if (raw === '' || raw === null) {
      setValues(v => ({ ...v, [field.key]: '' }))
      return
    }
    const min = field.min ?? 1
    setValues(v => ({ ...v, [field.key]: Math.max(min, Number(raw) || min) }))
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

  const sizeMissing = fields.some(
    f => f.required && (values[f.key] === '' || values[f.key] == null),
  )

  const canContinue =
    !!line && Number(line.total) > 0 && artworkReady(service, fileResult)

  // The button says what is missing rather than sitting mute and grey.
  // A disabled control that explains nothing is a dead end.
  const continueLabel =
    sizeMissing ? 'Enter the size to continue'
    : !line ? 'Working out the price…'
    : needsFile && !fileResult ? 'Upload artwork to continue'
    : needsFile && fileResult?.verdict === 'refuse' ? 'Send different artwork'
    : needsFile && fileResult?.verdict === 'warn' && !fileResult.warning_accepted
      ? 'Accept the note to continue'
    : 'Checkout'

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

            {/* ── The size, first ──────────────────────────────── */}

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

              {byArea && (
                <p className="mt-3 text-xs leading-relaxed text-body">
                  Printed to the exact size you enter — please check your
                  measurements.
                </p>
              )}
            </div>

            {/* ── Then the artwork ─────────────────────────────── */}

            {needsFile && line?.id && (
              <ArtworkUpload
                order={order}
                lineId={line.id}
                result={fileResult}
                onResult={setFileResult}
              />
            )}

            {needsFile && !line?.id && (
              <div className="mt-5 pt-5 border-t border-rule">
                <p className="text-[0.95rem] font-semibold text-body/60">
                  Your artwork
                </p>
                <p className="mt-1 text-xs text-body/60">
                  Set the size above and we’ll check your file against it.
                </p>
              </div>
            )}

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

            <div className="mt-5 rounded-xl border border-rule bg-substrate/40
                            px-4 py-3">
              <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[0.7rem] text-body">
                    {line
                      ? `${describeLine(line)} · ${line.quantity} piece${line.quantity === 1 ? '' : 's'}`
                      : 'Set a size to see the price'}
                  </p>
                  <p className="text-xl font-extrabold tabular-nums transition-opacity"
                     style={{ opacity: pricing ? 0.45 : 1 }}>
                    {/* This item, not the order. With a banner already
                        in the cart, the order total would price the
                        flyers at both. */}
                    {line ? `GHS ${line.total}` : '—'}
                  </p>
                </div>

                <div className="mt-3 sm:mt-0 flex items-center gap-3 sm:gap-4 shrink-0">
                  {canContinue && (
                    <button
                      onClick={() => navigate('/')}
                      className="text-xs sm:text-sm font-semibold underline
                                 underline-offset-4 decoration-rule hover:decoration-ink
                                 transition-colors"
                    >
                      Add another item
                    </button>
                  )}
                  <button
                    disabled={!canContinue}
                    onClick={() => navigate('/checkout')}
                    className={`flex-1 sm:flex-none inline-flex items-center
                                justify-center gap-2 px-5 py-2.5 rounded-lg text-sm
                                font-semibold transition-colors focus:outline-none
                                focus-visible:ring-2 focus-visible:ring-ink
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
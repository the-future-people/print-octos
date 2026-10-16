import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCatalogue, quoteLine, commitLine } from '../api/client'
import { useCart } from '../lib/CartContext.jsx'
import { useToast } from '../lib/ToastContext.jsx'
import { serviceImage } from '../lib/images'
import ArtworkUpload from '../components/ArtworkUpload.jsx'
import Header from '../components/Header.jsx'
/**
 * Configuring one item.
 *
 * Nothing here touches the server's idea of what has been ordered. The
 * size, the quantity, the finishing and the artwork all live in this
 * page until the customer presses Continue — so someone who opens a
 * banner, looks at the price and wanders back to the catalogue leaves
 * nothing behind.
 *
 * That was the whole trouble with the previous version: it created an
 * order the moment the page opened, which meant phantom cart items,
 * half-made lines, and a page forever trying to work out which line
 * was its own.
 *
 * Pricing and the artwork check both happen on the server and commit
 * nothing. The check hands back a signed verdict that the commit
 * verifies against the file and the size it was judged at — so a
 * customer cannot pass a good file and send something else.
 *
 * Finishing (lamination, binding, an envelope) is chosen here too, and
 * priced by the server with everything else. Something not available
 * yet is shown, so the customer knows it exists, but cannot be ticked.
 */
export default function Specify() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const toast = useToast()

  const { data: services = [], isLoading: loadingCatalogue } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  // A product may come in versions (front only, front and back), each a
  // service of its own with its own price. The address can name either;
  // the page shows the product, and the chosen version is what is priced
  // and ordered.
  const product = services.find(
    s => String(s.id) === String(serviceId)
      || (s.variants || []).some(v => String(v.id) === String(serviceId)),
  )
  const [variantId, setVariantId] = useState(null)
  const variants = product?.variants || []
  const service = variants.find(v => v.id === variantId) || product

  const [values, setValues] = useState({})
  const [quantity, setQuantity] = useState(1)
  const [chosen, setChosen] = useState([])
  const [quote, setQuote] = useState(null)
  const [pricing, setPricing] = useState(false)
  const [artwork, setArtwork] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [problem, setProblem] = useState('')

  // One key per attempt. A commit whose response is lost is a normal
  // event on mobile data, and the retry carries the same key so the
  // server returns what it did the first time rather than doing it
  // again.
  const commitKey = useRef(crypto.randomUUID().replace(/-/g, ''))

  // Pages are never typed online: the file says how many it has. The
  // counter still asks, because there the job arrives as paper.
  const fromFile = !!service?.counts_pages
  const fields = useMemo(
    () => (service?.spec_template || []).filter(
      f => f.key !== 'quantity' && !(fromFile && f.key === 'pages'),
    ),
    [service, fromFile],
  )

  const quantityField = useMemo(
    () => (service?.spec_template || []).find(f => f.key === 'quantity'),
    [service],
  )

  const addons = service?.addons || []
  const byArea = service?.unit === 'PER_SQFT' || service?.unit === 'PER_SQCM'
  const comingSoon = service && service.available === false

  // A fresh form for a fresh item. Switching product, or coming back
  // after adding something, starts over — the item that was added
  // lives in the cart now, and that is where it is changed.
  useEffect(() => {
    if (!product) return
    const named = (product.variants || []).find(v => String(v.id) === String(serviceId))
    setVariantId(named?.id ?? product.variants?.[0]?.id ?? null)
    setValues(
      Object.fromEntries(
        (product.spec_template || [])
          .filter(f => f.key !== 'quantity' && !(product.counts_pages && f.key === 'pages'))
          .map(f => [f.key, f.default ?? '']),
      ),
    )
    setQuantity(product.spec_template?.find(f => f.key === 'quantity')?.min ?? 1)
    setChosen([])
    setQuote(null)
    setArtwork(null)
    setProblem('')
    commitKey.current = crypto.randomUUID().replace(/-/g, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  // Changing the sides keeps everything the customer entered. The
  // artwork was checked for the other version, so it is checked again,
  // and finishing the new version does not offer is let go.
  function chooseVariant(id) {
    if (id === variantId) return
    const next = variants.find(v => v.id === id)
    setVariantId(id)
    setArtwork(null)
    setChosen(c => c.filter(a => (next?.addons || []).some(x => x.id === a && x.available)))
    commitKey.current = crypto.randomUUID().replace(/-/g, '')
  }

  const sizeMissing = fields.some(
    f => f.required && (values[f.key] === '' || values[f.key] == null),
  )

  // Sheets per copy, from the file's pages and the sides. The server
  // works this out again from the file itself when the item is added;
  // this is only so the customer sees the price first.
  const pageCount = artwork ? Math.max(1, Number(artwork.page_count) || 1) : null
  const sheets = pageCount ? Math.ceil(pageCount / (service?.pages_per_sheet || 1)) : null
  const waitingForFile = fromFile && !sheets

  // Priced after a pause rather than on every keystroke, and priced by
  // the server: the browser does no arithmetic, because two
  // implementations of one sum always drift apart. Finishing is part
  // of the price, so ticking one asks again.
  useEffect(() => {
    if (!service || sizeMissing || comingSoon || waitingForFile) {
      setQuote(null)
      return
    }

    const timer = setTimeout(() => {
      setPricing(true)
      setProblem('')

      quoteLine(
        service.id, Number(quantity) || 1,
        fromFile ? { ...values, pages: sheets } : values,
        chosen,
      )
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
  }, [service, values, quantity, chosen, sizeMissing, comingSoon, waitingForFile, sheets, fromFile])

  // The artwork was judged against a size. Changing the size retires
  // the verdict — a file fine on a small print is refused across six
  // feet, and the server would refuse a stale token anyway.
  useEffect(() => {
    setArtwork(null)
  }, [values])

  async function handleContinue(thenWhat) {
    if (committing) return

    setCommitting(true)
    setProblem('')

    try {
      const { data } = await commitLine({
        key: commitKey.current,
        orderNumber: cart.saved?.order_number,
        token: cart.saved?.access_token,
        serviceId: service.id,
        quantity: Number(quantity) || 1,
        specifications: values,
        addons: chosen,
        artworkToken: artwork?.token,
      })

      cart.adopt(data)
      toast.show(
        `${product.name} added to your cart`,
        'We’ll keep it for 7 days — pick up where you left off any time.',
      )

      navigate(thenWhat === 'checkout' ? '/checkout' : '/')
    } catch (err) {
      setProblem(
        err.response?.data?.detail ||
        'We couldn’t add that just now. Try again in a moment.',
      )
      // A new key: whatever went wrong, the next press is a fresh
      // attempt rather than a retry of a thing that never happened.
      commitKey.current = crypto.randomUUID().replace(/-/g, '')
      setCommitting(false)
    }
  }

  function setField(key, raw) {
    // Raw while typing. Clamping on every keystroke turns the first
    // digit of 168 into a 6.
    setValues(v => ({ ...v, [key]: raw === '' ? '' : Number(raw) }))
  }

  function clampField(field, raw) {
    // An empty field stays empty. Filling it with the minimum would
    // put a number there the customer never chose.
    if (raw === '' || raw === null) {
      setValues(v => ({ ...v, [field.key]: '' }))
      return
    }
    const min = field.min ?? 1
    setValues(v => ({ ...v, [field.key]: Math.max(min, Number(raw) || min) }))
  }

  function stepQuantity(by) {
    const step = quantityField?.step || 1
    const min = quantityField?.min || 1
    setQuantity(q => Math.max(min, (Number(q) || min) + by * step))
  }

  function toggleAddon(addon) {
    if (!addon.available) return
    setChosen(c => (c.includes(addon.id) ? c.filter(id => id !== addon.id) : [...c, addon.id]))
  }

  if (loadingCatalogue) {
    return <Shell><p className="py-12 text-sm text-body">Loading…</p></Shell>
  }

  if (!product || !service) {
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

  const photo = serviceImage(product.base_name || product.name)
  const needsFile = service.requires_file_upload

  const artworkReady =
    !needsFile ||
    (artwork && artwork.verdict !== 'refuse' && artwork.token)

  const canContinue = !comingSoon && !!quote && artworkReady && !committing

  const continueLabel =
    comingSoon ? 'Coming soon'
    : committing ? 'Adding…'
    : sizeMissing ? 'Enter the details to continue'
    : !quote ? 'Working out the price…'
    : needsFile && !artwork ? 'Upload artwork to continue'
    : needsFile && artwork?.verdict === 'refuse' ? 'Send different artwork'
    : 'Checkout'

  return (
    <div className="min-h-screen bg-white text-ink">

      <Header back />

      <main className="max-w-4xl mx-auto px-5 pb-12">

        <div className="mt-6 sm:flex sm:gap-5 lg:gap-8">

          <div className="flex gap-3 sm:block sm:w-[150px] lg:w-[200px] shrink-0">
            {photo ? (
              <img src={photo} alt={product.name}
                   className="w-20 h-20 sm:w-full sm:h-auto sm:aspect-[4/3]
                              object-cover rounded-xl border border-rule shrink-0" />
            ) : (
              <div className="w-20 h-20 sm:w-full sm:aspect-[4/3] rounded-xl
                              bg-substrate border border-rule shrink-0" />
            )}

            <div className="min-w-0 sm:hidden">
              <h1 className="text-lg font-bold leading-tight">{product.name}</h1>
              <p className="mt-1 text-xs leading-snug text-body line-clamp-3">
                {product.description}
              </p>
            </div>
          </div>

          <div className="mt-4 sm:mt-0 sm:flex-1 sm:min-w-0">

            <div className="hidden sm:block">
              <h1 className="text-xl lg:text-2xl font-bold">{product.name}</h1>
              <p className="mt-2 text-sm leading-relaxed text-body">
                {product.description}
              </p>
            </div>

            {comingSoon && (
              <div className="mt-5 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3">
                <p className="text-sm font-semibold">Coming soon</p>
                <p className="mt-1 text-xs leading-relaxed text-body">
                  We’re getting ready to make this. Check back soon, or walk in
                  and ask about it.
                </p>
              </div>
            )}

            {/* ── The details ──────────────────────────────────── */}

            <div className={`mt-5 pt-5 border-t border-rule ${comingSoon ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="flex items-center gap-2 text-[0.95rem] font-semibold">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                     className="w-4 h-4 text-farhat" aria-hidden="true">
                  <path d="M3 9h18v6H3z" />
                  <path d="M7 9v3M11 9v3M15 9v3M19 9v3" />
                </svg>
                {byArea ? 'How big?' : 'Your order'}
              </p>

              {variants.length > 1 && (
                <div className="mt-3">
                  <span className="block mb-1.5 text-xs text-body">Sides</span>
                  <div role="radiogroup" aria-label="Sides"
                       className="inline-flex p-1 rounded-lg bg-substrate gap-1">
                    {variants.map(v => {
                      const on = v.id === service.id
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={v.available === false}
                          onClick={() => chooseVariant(v.id)}
                          className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors
                                      focus:outline-none focus-visible:ring-2 focus-visible:ring-ink
                                      disabled:opacity-40 disabled:cursor-not-allowed
                                      ${on ? 'bg-white text-ink shadow-sm' : 'text-body hover:text-ink'}`}
                        >
                          {v.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {fields.length > 0 && (
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
              )}

              <div className="mt-4">
                <span className="block mb-1.5 text-xs text-body">
                  {quantityField?.label && quantityField.label !== 'Quantity'
                    ? quantityField.label
                    : 'How many?'}
                  {quantityField?.step > 1 && (
                    <span className="text-body/70">
                      {' '}· in {quantityField.step}s
                    </span>
                  )}
                </span>
                <div className="inline-flex items-center gap-3">
                  <button onClick={() => stepQuantity(-1)} aria-label="Fewer"
                          className="w-10 h-10 rounded-lg border border-rule text-lg
                                     hover:border-ink focus:outline-none
                                     focus-visible:ring-2 focus-visible:ring-ink">
                    −
                  </button>
                  <input
                    type="number" inputMode="numeric"
                    min={quantityField?.min || 1}
                    step={quantityField?.step || 1}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={e => setQuantity(
                      Math.max(quantityField?.min || 1, Number(e.target.value) || 1),
                    )}
                    className="w-20 px-2 py-2.5 text-center rounded-lg border border-rule
                               text-[0.95rem] tabular-nums focus:outline-none focus:border-ink"
                  />
                  <button onClick={() => stepQuantity(1)} aria-label="More"
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

            {/* ── Finishing ────────────────────────────────────── */}

            {addons.length > 0 && !comingSoon && (
              <div className="mt-5 pt-5 border-t border-rule">
                <p className="flex items-center gap-2 text-[0.95rem] font-semibold">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                       className="w-4 h-4 text-farhat" aria-hidden="true">
                    <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" />
                  </svg>
                  Finishing
                  <span className="text-xs font-normal text-body">· optional</span>
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {addons.map(addon => {
                    const on = chosen.includes(addon.id)
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon)}
                        disabled={!addon.available}
                        aria-pressed={on}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border
                                    text-left transition-colors focus:outline-none
                                    focus-visible:ring-2 focus-visible:ring-ink
                                    ${!addon.available
                                      ? 'border-rule bg-substrate/50 cursor-not-allowed'
                                      : on
                                        ? 'border-farhat bg-farhat/5'
                                        : 'border-rule hover:border-ink'}`}
                      >
                        <span className={`w-5 h-5 shrink-0 rounded border flex items-center
                                          justify-center
                                          ${on ? 'bg-farhat border-farhat text-white'
                                               : 'border-rule bg-white'}`}>
                          {on && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5"
                                 aria-hidden="true">
                              <path d="M5 12l5 5L20 7" />
                            </svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-semibold
                                            ${addon.available ? '' : 'text-body/60'}`}>
                            {addon.name}
                          </span>
                          <span className="block text-xs text-body">
                            {!addon.available
                              ? 'Not available yet'
                              : addon.price ? `GHS ${addon.price} ${perWord(addon.unit)}` : ''}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Then the artwork ─────────────────────────────── */}

            {needsFile && !sizeMissing && !comingSoon && (
              <ArtworkUpload
                service={service}
                specifications={values}
                result={artwork}
                onResult={setArtwork}
              />
            )}

            {needsFile && sizeMissing && !comingSoon && (
              <div className="mt-5 pt-5 border-t border-rule">
                <p className="text-[0.95rem] font-semibold text-body/60">
                  Your artwork
                </p>
                <p className="mt-1 text-xs text-body/60">
                  Fill in the details above and we’ll check your file against them.
                </p>
              </div>
            )}

            {problem && (
              <p className="mt-4 text-sm text-farhat">{problem}</p>
            )}

            {quote?.minimum_applied && (
              <p className="mt-4 rounded-lg bg-substrate px-3.5 py-3 text-xs
                            leading-relaxed text-body">
                This size is below our minimum, so each piece is charged at the
                minimum rate.
              </p>
            )}

            {/* ── What it comes to ─────────────────────────────── */}

            <div className="mt-5 rounded-xl border border-rule bg-substrate/40
                            px-4 py-3">
              {quote?.addons?.length > 0 && (
                <div className="mb-2 pb-2 border-b border-rule space-y-1 text-xs text-body">
                  <div className="flex justify-between gap-3">
                    <span>{product.name}{variants.length > 1 ? ` · ${service.label}` : ''}</span>
                    <span className="tabular-nums">GHS {quote.base_total}</span>
                  </div>
                  {quote.addons.map(a => (
                    <div key={a.service} className="flex justify-between gap-3">
                      <span>+ {a.service_name}{a.detail ? ` (${a.detail})` : ''} × {a.quantity}</span>
                      <span className="tabular-nums">GHS {a.total}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[0.7rem] text-body">
                    {comingSoon
                      ? 'Not available to order yet'
                      : waitingForFile
                        ? `GHS ${service.price ?? '—'} per sheet · upload your file to see the total`
                        : quote
                          ? fromFile
                            ? `${pageCount} page${pageCount === 1 ? '' : 's'} · ${sheets} sheet${sheets === 1 ? '' : 's'} a copy · ${quote.quantity} ${unitWord(quantityField, quote.quantity)}`
                            : `${describe(quote)} · ${quote.quantity} ${unitWord(quantityField, quote.quantity)}`
                          : 'Fill in the details to see the price'}
                  </p>
                  <p className="text-xl font-extrabold tabular-nums transition-opacity"
                     style={{ opacity: pricing ? 0.45 : 1 }}>
                    {quote ? `GHS ${quote.total}` : '—'}
                  </p>
                </div>

                <div className="mt-3 sm:mt-0 flex items-center gap-3 sm:gap-4 shrink-0">
                  {canContinue && (
                    <button
                      onClick={() => handleContinue('catalogue')}
                      className="text-xs sm:text-sm font-semibold underline
                                 underline-offset-4 decoration-rule hover:decoration-ink
                                 transition-colors"
                    >
                      Add another item
                    </button>
                  )}
                  <button
                    disabled={!canContinue}
                    onClick={() => handleContinue('checkout')}
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

function describe(quote) {
  const spec = quote.specifications || {}
  if (spec.width_in && spec.height_in) {
    const area = (Number(spec.width_in) * Number(spec.height_in)) / 144
    return `${area.toFixed(1)} sq ft`
  }
  return `GHS ${quote.unit_price} each`
}

// "boxes", "copies", "pieces": the word the service sells in.
function unitWord(quantityField, n) {
  const unit = quantityField?.unit
  if (unit) return n === 1 ? unit.replace(/(es|s)$/, '') : unit
  const label = (quantityField?.label || '').toLowerCase()
  if (label.includes('cop')) return n === 1 ? 'copy' : 'copies'
  return n === 1 ? 'piece' : 'pieces'
}

// How an add-on is counted, beside its price.
function perWord(unit) {
  if (unit === 'sheet' || unit === 'PER_PAGE' || unit === 'PER_SHEET') return 'per sheet'
  return 'per copy'
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
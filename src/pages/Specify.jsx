import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCatalogue, quoteLine, commitLine, commitBatch } from '../api/client'
import { useCart } from '../lib/CartContext.jsx'
import { useToast } from '../lib/ToastContext.jsx'
import { useAccount } from '../lib/AccountContext.jsx'
import { serviceImage } from '../lib/images'
import ArtworkUpload from '../components/ArtworkUpload.jsx'
import ArtworkBatch, { recheck } from '../components/ArtworkBatch.jsx'
import PagePicker from '../components/PagePicker.jsx'
import Header from '../components/Header.jsx'
import ProductBadge from '../components/ProductBadge.jsx'
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
 *
 * In the app the same page is laid out as an app screen: the product
 * card, numbered steps (your order, your file, finishing) and the total
 * held at the bottom. The logic is one and the same for both.
 */
export default function Specify() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const toast = useToast()
  const { inApp } = useAccount()

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
  // For packing add-ons: one envelope for all copies, or one per copy.
  // Unset means Octos's suggestion; the customer can change it.
  const [perCopy, setPerCopy] = useState({})
  const [quote, setQuote] = useState(null)
  const [pricing, setPricing] = useState(false)
  const [artwork, setArtwork] = useState(null)
  // Products priced by the page take several files at once, each checked
  // on its own and each its own line; everything else takes one.
  const [batch, setBatch] = useState([])
  const [batchQuotes, setBatchQuotes] = useState({})
  const [pickerFor, setPickerFor] = useState(null)
  // One key per batch attempt: a retry of a lost response is the same
  // batch, never a second one.
  const batchKey = useRef(crypto.randomUUID().replace(/-/g, ''))
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
  const batchMode = fromFile
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

  // Held steady between renders: a fresh empty list each time would make
  // the price below look changed on every render and re-ask forever.
  const addons = useMemo(() => service?.addons || [], [service])
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
    setPerCopy({})
    setQuote(null)
    setArtwork(null)
    setBatch([])
    setBatchQuotes({})
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
    // Every file was checked for the other version: check each again.
    setBatch(list => list.map(recheck))
    setBatchQuotes({})
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

  // What Octos suggests for packing: copies of a single sheet travel
  // together; a copy of several sheets is a set that goes somewhere.
  const suggestPerCopy = (sheets || Number(values.pages) || 1) > 1
  const packingFor = id => perCopy[id] ?? suggestPerCopy
  const addonsPayload = useMemo(
    () => chosen.map(id => {
      const addon = addons.find(a => a.id === id)
      return addon?.packing ? { service: id, per_copy: perCopy[id] ?? suggestPerCopy } : id
    }),
    [chosen, addons, perCopy, suggestPerCopy],
  )

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
        addonsPayload,
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
  }, [service, values, quantity, addonsPayload, sizeMissing, comingSoon, waitingForFile, sheets, fromFile])

  // ── Colour, black and white, one side and both ────────────────────
  // Each colour service knows its black-and-white twin (pair_colours),
  // and its sides by how many pages fit a sheet. A set's choices pick
  // the service it is priced and printed as.
  const byId = useMemo(() => {
    const map = {}
    services.forEach(s => { map[s.id] = s; (s.variants || []).forEach(v => { map[v.id] = v }) })
    return map
  }, [services])
  const family = useMemo(() => {
    const own = variants.length ? variants : (product ? [product] : [])
    const colourOwn = own.filter(v => v.bw_counterpart)
    if (colourOwn.length) {
      return { colour: colourOwn, mono: colourOwn.map(v => byId[v.bw_counterpart]).filter(Boolean) }
    }
    const ids = new Set(own.map(v => v.id))
    return { colour: Object.values(byId).filter(v => v.bw_counterpart && ids.has(v.bw_counterpart)), mono: own }
  }, [variants, product, byId])
  const canColour = family.colour.length > 0 && family.mono.length > 0
  const isDouble = v => Number(v?.pages_per_sheet) === 2
  const serviceIsColour = !!service?.bw_counterpart
  function serviceFor(set) {
    if (set.whole) return service
    const list = canColour ? (set.colour ? family.colour : family.mono) : (variants.length ? variants : [service])
    return list.find(v => isDouble(v) === !!set.double) || list[0] || service
  }
  // A file nobody has opened prints every page with the product's settings.
  const setsOf = item => (item.sets?.length
    ? item.sets
    : [{ id: 'all', whole: true, pages: null, colour: serviceIsColour, double: isDouble(service), copies: Number(quantity) || 1 }])
  // A file printed whole takes the product page's finishing; a set
  // carries its own.
  const addonsFor = set => (set.whole ? addonsPayload : (set.addons || []))
  const pagesIn = (item, set) => (set.whole ? Math.max(1, Number(item.result?.page_count) || 1) : set.pages.length)
  const priceSet = (item, set) => {
    const svc = serviceFor(set)
    const perCopy = Math.ceil(pagesIn(item, set) / (svc?.pages_per_sheet || 1))
    return quoteLine(svc.id, set.copies || 1, { ...values, pages: perCopy }, addonsFor(set)).then(r => r.data)
  }
  const pageLabel = pages => {
    const p = [...pages].sort((a, b) => a - b)
    const runs = []
    for (let i = 0; i < p.length; i++) {
      let j = i
      while (j + 1 < p.length && p[j + 1] === p[j] + 1) j++
      runs.push(i === j ? `${p[i]}` : `${p[i]}–${p[j]}`)
      i = j
    }
    return runs.join(', ')
  }

  // Several files: each priced by the server from its own pages, with
  // the same settings, finishing and copies. Asked once the checks are in.
  const batchReady = batch.filter(i => i.status === 'done' && i.result?.token && i.result.verdict !== 'refuse')
  const batchBusy = batch.some(i => i.status === 'waiting' || i.status === 'sending')
  const readyKey = batchReady.map(i => `${i.id}:${i.result.page_count}:${JSON.stringify(i.sets || null)}`).join('|')
  useEffect(() => {
    if (!batchMode || !service || comingSoon) return undefined
    if (!batchReady.length) { setBatchQuotes({}); return undefined }
    const timer = setTimeout(() => {
      setPricing(true)
      setProblem('')
      Promise.all(batchReady.flatMap(item => setsOf(item).map(set =>
        priceSet(item, set).then(q => [`${item.id}:${set.id}`, q]))))
        .then(pairs => setBatchQuotes(Object.fromEntries(pairs)))
        .catch(err => setProblem(err.response?.data?.detail || 'We could not price those files. Try again.'))
        .finally(() => setPricing(false))
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMode, service, readyKey, quantity, addonsPayload, values, comingSoon])
  const unitsOf = item => setsOf(item).map(set => batchQuotes[`${item.id}:${set.id}`])
  const batchPriced = batchReady.length > 0 && batchReady.every(i => unitsOf(i).every(Boolean))
  const itemTotal = item => unitsOf(item).reduce((sum, q) => sum + Number(q?.total || 0), 0)
  const batchTotal = batchReady.reduce((sum, i) => sum + itemTotal(i), 0)
  const batchPrices = Object.fromEntries(batchReady.filter(i => unitsOf(i).every(Boolean))
    .map(i => [i.id, itemTotal(i).toFixed(2)]))

  // The artwork was judged against a size. Changing the size retires
  // the verdict — a file fine on a small print is refused across six
  // feet, and the server would refuse a stale token anyway.
  useEffect(() => {
    setArtwork(null)
  }, [values])

  // Each good file its own line, one after another. A line added stays
  // added: if the connection drops halfway, Continue carries on with the
  // rest, each with its own key so a retry is never a second copy.
  // Every file and every set in one request: added all together or not
  // at all, priced by the server from each set's own pages, so the cart
  // always matches what was shown here.
  async function handleBatchContinue(thenWhat) {
    if (committing) return
    setCommitting(true)
    setProblem('')
    try {
      const { data } = await commitBatch({
        key: batchKey.current,
        orderNumber: cart.saved?.order_number,
        token: cart.saved?.access_token,
        specifications: values,
        files: batchReady.map(item => ({
          artwork_token: item.result.token,
          checked_service: service.id,
          sets: setsOf(item).map(set => ({
            service: serviceFor(set).id,
            quantity: set.copies || 1,
            page_selection: set.whole ? null : pageLabel(set.pages),
            addons: addonsFor(set),
          })),
        })),
      })
      cart.adopt(data)
      const added = data?.line_ids?.length || 0
      setBatch([])
      batchKey.current = crypto.randomUUID().replace(/-/g, '')
      toast.show(
        `${added} item${added === 1 ? '' : 's'} added to your cart`,
        'We’ll keep it for 7 days — pick up where you left off any time.',
      )
      navigate(thenWhat === 'checkout' ? '/checkout' : '/')
    } catch (err) {
      setProblem(err.response?.data?.detail || 'We couldn’t add those just now. Try again in a moment.')
      batchKey.current = crypto.randomUUID().replace(/-/g, '')
      setCommitting(false)
    }
  }

  async function handleContinue(thenWhat) {
    if (batchMode) return handleBatchContinue(thenWhat)
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
        addons: addonsPayload,
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

  const canContinue = batchMode
    ? !comingSoon && batchPriced && !batchBusy && !committing
    : !comingSoon && !!quote && artworkReady && !committing

  const continueLabel =
    batchMode ? (
      comingSoon ? 'Coming soon'
      : committing ? 'Adding…'
      : batch.length === 0 ? 'Add your files to continue'
      : batchBusy ? 'Checking your files…'
      : !batchReady.length ? 'None of these can be printed'
      : !batchPriced ? 'Working out the price…'
      : 'Checkout'
    )
    : comingSoon ? 'Coming soon'
    : committing ? 'Adding…'
    : sizeMissing ? 'Enter the details to continue'
    : !quote ? 'Working out the price…'
    : needsFile && !artwork ? 'Upload artwork to continue'
    : needsFile && artwork?.verdict === 'refuse' ? 'Send different artwork'
    : 'Checkout'

  // What the total shows: the files added up, or the one item.
  const shownTotal = batchMode ? (batchPriced ? batchTotal.toFixed(2) : null) : (quote ? quote.total : null)
  const copies = Number(quantity) || 1

  const pickerItem = batch.find(i => i.id === pickerFor)
  const picker = pickerItem && (
    <PagePicker
      file={pickerItem.file}
      pageCount={pickerItem.result?.page_count}
      sets={pickerItem.sets || []}
      onChange={sets => setBatch(list => list.map(i => (i.id === pickerItem.id ? { ...i, sets } : i)))}
      onClose={() => setPickerFor(null)}
      canColour={canColour}
      defaults={{ colour: serviceIsColour, double: isDouble(service), copies: Number(quantity) || 1 }}
      priceOf={set => priceSet(pickerItem, set).then(q => q.total)}
      addons={addons}
    />
  )

  if (inApp) {
    return (
      <>
      {picker}
      <AppSpecify
        {...{
          product, service, variants, photo, fields, values, quantity, quantityField,
          addons, chosen, byArea, comingSoon, needsFile, sizeMissing, artwork, setArtwork,
          quote, pricing, problem, canContinue, committing, fromFile, pageCount, sheets,
          waitingForFile, chooseVariant, setField, clampField, setValues, stepQuantity,
          setQuantity, toggleAddon, packingFor, setPerCopy, handleContinue, cartCount: cart.count,
          navigate, batchMode, batch, setBatch, batchQuotes, batchReady, shownTotal, copies,
          batchPrices, setPickerFor, itemTotal,
        }}
        continueLabel={continueLabel === 'Checkout' ? 'Continue' : continueLabel}
      />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-white text-ink">

      <Header back />
      {picker}

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
                  <span className="text-xs font-normal text-body">
                    · optional{batchMode ? ': for files printed whole; a set of pages chooses its own' : ''}
                  </span>
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {addons.map(addon => {
                    const on = chosen.includes(addon.id)
                    const askPacking = on && addon.packing && (Number(quantity) || 1) > 1
                    return (
                      <div key={addon.id} className="flex flex-col gap-1.5">
                      <button
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
                              : Number(addon.price) === 0
                                ? 'Free'
                                : addon.price ? `GHS ${addon.price} ${perWord(addon.unit)}` : ''}
                          </span>
                        </span>
                      </button>
                      {askPacking && (
                        <div role="radiogroup" aria-label={`${addon.name}: how many`}
                             className="flex gap-1 p-1 rounded-lg bg-substrate">
                          {[
                            { value: false, label: 'One for all copies' },
                            { value: true, label: 'One per copy' },
                          ].map(opt => {
                            const picked = packingFor(addon.id) === opt.value
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                role="radio"
                                aria-checked={picked}
                                onClick={() => setPerCopy(p => ({ ...p, [addon.id]: opt.value }))}
                                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold
                                            transition-colors focus:outline-none
                                            focus-visible:ring-2 focus-visible:ring-ink
                                            ${picked ? 'bg-white text-ink shadow-sm' : 'text-body hover:text-ink'}`}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Then the artwork ─────────────────────────────── */}

            {needsFile && !sizeMissing && !comingSoon && (batchMode ? (
              <div className="mt-5 pt-5 border-t border-rule">
                <p className="text-[0.95rem] font-semibold">Your files</p>
                <p className="mt-0.5 text-xs text-body">
                  Each one is checked before you pay, and printed with the settings above.
                </p>
                <ArtworkBatch service={service} specifications={values} items={batch} setItems={setBatch}
                              prices={batchPrices} onOpen={item => setPickerFor(item.id)} />
              </div>
            ) : (
              <ArtworkUpload
                service={service}
                specifications={values}
                result={artwork}
                onResult={setArtwork}
              />
            ))}

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
              <div className="mt-4 rounded-lg bg-substrate px-3.5 py-3 text-xs
                              leading-relaxed text-body">
                <p>
                  Our smallest order is GHS {quote.minimum}, and your size is printed
                  exactly as you entered it.
                  {quote.covers_up_to > (Number(quantity) || 1) && (
                    <> That GHS {quote.minimum} already covers up to{' '}
                    <strong className="text-ink">{quote.covers_up_to} pieces</strong> this size.</>
                  )}
                </p>
                {quote.covers_up_to > (Number(quantity) || 1) && (
                  <button
                    type="button"
                    onClick={() => setQuantity(quote.covers_up_to)}
                    className="mt-2 px-3 py-1.5 rounded-md border border-ink text-xs
                               font-semibold text-ink hover:bg-ink hover:text-white
                               transition-colors focus:outline-none focus-visible:ring-2
                               focus-visible:ring-ink"
                  >
                    Make it {quote.covers_up_to}
                  </button>
                )}
              </div>
            )}

            {/* ── What it comes to ─────────────────────────────── */}

            <div className="mt-5 rounded-xl border border-rule bg-substrate/40
                            px-4 py-3">
              {!batchMode && quote?.addons?.length > 0 && (
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
                    {batchMode && !comingSoon
                      ? (batchReady.length
                          ? `${batchReady.length} file${batchReady.length === 1 ? '' : 's'} · ${copies} ${unitWord(quantityField, copies)} each`
                          : 'Add your files to see the total')
                      : comingSoon
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
                    {shownTotal ? `GHS ${shownTotal}` : '—'}
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
  if (unit === 'PER_SQFT') return 'per sq ft'
  if (unit === 'sheet' || unit === 'PER_PAGE' || unit === 'PER_SHEET') return 'per sheet'
  return 'per copy'
}

function Shell({ children }) {
  const { inApp } = useAccount()
  return (
    <div className="min-h-screen bg-white text-ink">
      {inApp ? <Header /> : (
        <header className="bg-farhat px-5 py-4">
          <p className="max-w-4xl mx-auto text-base font-bold text-white">
            Farhat<span className="font-normal text-white/85"> Printing Press</span>
          </p>
        </header>
      )}
      <main className="max-w-4xl mx-auto px-5">{children}</main>
    </div>
  )
}

// ── The app's layout ─────────────────────────────────────────────

const SECTION = { PRODUCTION: 'Order ahead', INSTANT: 'Documents & flyers' }

// Small facts about the product, read from what it is.
function specChips(product) {
  const n = `${product.base_name || ''} ${product.name}`.toLowerCase()
  if (/banner|flexy/.test(n)) return ['Outdoor flex', 'Any size from 1 inch']
  if (/sticker|sav\b|vinyl/.test(n)) return ['Self-adhesive vinyl', 'Any size from 1 inch']
  if (/business card|\bcards?\b/.test(n)) return ['Box of 100', 'One side or both, same price']
  const chips = []
  const size = (n.match(/\ba([3-5])\b/) || [])[1]
  if (size) chips.push({ 3: 'A3 size (297 × 420 mm)', 4: 'A4 size (210 × 297 mm)', 5: 'A5 size (148 × 210 mm)' }[size])
  if (/b&w|black/.test(n)) chips.push('Black & white')
  else if (/colou?r|flyer|poster/.test(n)) chips.push('Full colour')
  return chips
}

// A clear picture for each kind of finishing, until there are photos.
function FinishingIcon({ name }) {
  const n = (name || '').toLowerCase()
  const path =
    /bind/.test(n) ? <><rect x="6" y="3" width="13" height="18" rx="1.5" /><path d="M6 6H4M6 10H4M6 14H4M6 18H4" /></>
    : /lamin/.test(n) ? <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8 7l8 0M14 12l3-3" /></>
    : /envelope/.test(n) ? <><rect x="3" y="6" width="18" height="12" rx="1.5" /><path d="M3 7l9 6 9-6" /></>
    : /bag/.test(n) ? <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>
    : /cut/.test(n) ? <><circle cx="6" cy="17" r="2.5" /><circle cx="6" cy="7" r="2.5" /><path d="M8 8.5L20 18M8 15.5L20 6" /></>
    : /eyelet/.test(n) ? <><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2.5" /></>
    : <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" />
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
      {path}
    </svg>
  )
}

function StepTitle({ n, title, note }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-full bg-farhat text-white grid place-items-center text-sm font-extrabold">{n}</span>
      <h2 className="text-lg font-bold">{title}</h2>
      {note && <span className="text-sm text-body">{note}</span>}
    </div>
  )
}

function AppSpecify(p) {
  const {
    product, service, variants, photo, fields, values, quantity, quantityField, addons, chosen,
    byArea, comingSoon, needsFile, sizeMissing, artwork, setArtwork, quote, pricing, problem,
    canContinue, continueLabel, fromFile, pageCount, sheets, waitingForFile, chooseVariant,
    setField, clampField, setValues, stepQuantity, setQuantity, toggleAddon, packingFor,
    setPerCopy, handleContinue, cartCount, navigate,
    batchMode, batch, setBatch, batchQuotes, batchReady, shownTotal, copies,
    batchPrices, setPickerFor, itemTotal,
  } = p
  void itemTotal
  const [breakdown, setBreakdown] = useState(false)
  const chips = specChips(product)
  let step = 0

  const cartButton = (
    <button onClick={() => navigate('/checkout')} aria-label="Cart"
            className="relative w-11 h-11 grid place-items-center text-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]" aria-hidden="true">
        <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
        <path d="M2 3h2.5l2.3 11.5a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" />
      </svg>
      {cartCount > 0 && (
        <span className="absolute top-1 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gold text-ink
                         text-[0.6rem] font-extrabold leading-4 text-center">{cartCount}</span>
      )}
    </button>
  )

  const unit = unitWord(quantityField, Number(quantity) || 1)

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header title={product.name} subtitle={SECTION[product.category] || null} action={cartButton} />

      <main className="max-w-md mx-auto px-4 pb-44">
        {/* The product. */}
        <div className="flex gap-3.5 p-3 rounded-2xl bg-[#f7f6f3]">
          {photo ? (
            <img src={photo} alt="" className="w-[42%] aspect-[4/3] object-cover rounded-xl shrink-0" />
          ) : (
            <div className="w-[42%] aspect-[4/3] rounded-xl bg-[#fdecec] grid place-items-center shrink-0">
              <span className="scale-[2.4]"><ProductBadge name={product.base_name || product.name} onLight /></span>
            </div>
          )}
          <div className="min-w-0 flex flex-col">
            <p className="text-[0.95rem] font-extrabold leading-tight">{product.name}</p>
            <p className="mt-1 text-xs leading-snug text-body line-clamp-3">{product.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map(c => (
                <span key={c} className="px-2 py-0.5 rounded-lg bg-white text-[0.65rem] font-semibold text-ink/80">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {comingSoon && (
          <div className="mt-4 rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3">
            <p className="text-sm font-semibold">Coming soon</p>
            <p className="mt-1 text-xs leading-relaxed text-body">
              We’re getting ready to make this. Check back soon, or walk in and ask about it.
            </p>
          </div>
        )}

        <div className={comingSoon ? 'opacity-50 pointer-events-none' : ''}>
          {/* ── Your order ── */}
          <section className="mt-6">
            <StepTitle n={++step} title={byArea ? 'Size & quantity' : 'Your order'} />

            {variants.length > 1 && (
              <>
                <p className="mt-3 text-sm text-body">Print sides</p>
                <div role="radiogroup" aria-label="Sides" className="mt-2 grid grid-cols-2 gap-2.5">
                  {variants.map((v, i) => {
                    const on = v.id === service.id
                    return (
                      <button key={v.id} type="button" role="radio" aria-checked={on}
                              disabled={v.available === false} onClick={() => chooseVariant(v.id)}
                              className={`flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2
                                          text-sm font-semibold transition-colors disabled:opacity-40
                                          ${on ? 'border-farhat bg-farhat/5 text-farhat' : 'border-[#ece9e3] text-ink'}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                             strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
                          {i === 0
                            ? <path d="M7 3h7l4 4v14H7z" />
                            : <><path d="M9 3h7l4 4v12H9z" /><path d="M5 7v14h10" /></>}
                        </svg>
                        {v.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {fields.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {fields.map(field => (
                  <label key={field.key} className="block">
                    <span className="block mb-1.5 text-sm text-body">
                      {field.label}{field.unit ? ` (${field.unit})` : ''}
                    </span>
                    {field.type === 'select' ? (
                      <select value={values[field.key] ?? ''}
                              onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                              className="w-full px-3 py-3 rounded-xl border border-[#ece9e3] bg-white text-[1rem]
                                         focus:outline-none focus:border-ink">
                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input type="number" inputMode="numeric" min={field.min ?? 1} max={field.max}
                             placeholder={field.placeholder || ''} value={values[field.key] ?? ''}
                             onChange={e => setField(field.key, e.target.value)}
                             onBlur={e => clampField(field, e.target.value)}
                             className="w-full px-3 py-3 rounded-xl border border-[#ece9e3] bg-white text-[1rem]
                                        tabular-nums placeholder:text-body/40 focus:outline-none focus:border-ink" />
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-body">
                {quantityField?.label && quantityField.label !== 'Quantity' ? quantityField.label : 'How many?'}
                {quantityField?.step > 1 && <span className="text-body/70"> · in {quantityField.step}s</span>}
              </span>
              <div className="flex items-center rounded-2xl border border-[#ece9e3] overflow-hidden">
                <button onClick={() => stepQuantity(-1)} aria-label="Fewer"
                        className="w-11 h-11 grid place-items-center text-xl">−</button>
                <input type="number" inputMode="numeric" min={quantityField?.min || 1} step={quantityField?.step || 1}
                       value={quantity}
                       onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                       onBlur={e => setQuantity(Math.max(quantityField?.min || 1, Number(e.target.value) || 1))}
                       className="w-14 h-11 text-center text-[1rem] font-semibold tabular-nums border-x border-[#ece9e3]
                                  focus:outline-none" />
                <button onClick={() => stepQuantity(1)} aria-label="More"
                        className="w-11 h-11 grid place-items-center text-xl text-farhat bg-farhat/5">+</button>
              </div>
            </div>

            {byArea && (
              <p className="mt-2.5 text-xs leading-relaxed text-body">
                Printed to the exact size you enter. Please check your measurements.
              </p>
            )}
          </section>

          {/* ── Your file ── */}
          {needsFile && (
            <section className="mt-7">
              <StepTitle n={++step} title={batchMode ? 'Your files' : 'Your file'} />
              {batchMode ? (
                <ArtworkBatch service={service} specifications={values} items={batch} setItems={setBatch}
                              prices={batchPrices} onOpen={item => setPickerFor(item.id)} />
              ) : sizeMissing ? (
                <p className="mt-2 text-sm text-body">Enter the size above, and we’ll check your file against it.</p>
              ) : (
                <div className="-mt-3">
                  <ArtworkUpload service={service} specifications={values} result={artwork} onResult={setArtwork} />
                </div>
              )}
              {!batchMode && fromFile && pageCount && (
                <p className="mt-2 text-xs text-body">
                  {pageCount} page{pageCount === 1 ? '' : 's'} · {sheets} sheet{sheets === 1 ? '' : 's'} a copy
                </p>
              )}
            </section>
          )}

          {/* ── Finishing ── */}
          {addons.length > 0 && (
            <section className="mt-7">
              <StepTitle n={++step} title="Finishing" note="Optional" />
              <p className="mt-1 ml-[38px] text-sm text-body">
                {batchMode ? 'For files printed whole. A set of pages chooses its own.' : 'Add finishing to your order.'}
              </p>
              <div className="mt-3 space-y-2.5">
                {addons.map(addon => {
                  const on = chosen.includes(addon.id)
                  const askPacking = on && addon.packing && (Number(quantity) || 1) > 1
                  const free = Number(addon.price) === 0
                  return (
                    <div key={addon.id}>
                      <button type="button" onClick={() => toggleAddon(addon)} disabled={!addon.available}
                              aria-pressed={on}
                              className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors
                                          ${!addon.available ? 'border-[#ece9e3] bg-[#f7f6f3] cursor-not-allowed'
                                            : on ? 'border-farhat bg-farhat/5' : 'border-[#ece9e3] bg-white'}`}>
                        <span className={`w-5 h-5 shrink-0 rounded-md border-2 grid place-items-center
                                          ${on ? 'bg-farhat border-farhat text-white' : 'border-[#d6d3cd] bg-white'}`}>
                          {on && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
                                 strokeLinecap="round" className="w-3 h-3" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                          )}
                        </span>
                        <span className={`w-12 h-12 rounded-xl grid place-items-center shrink-0
                                          ${addon.available ? 'bg-[#f3f1ec] text-ink/70' : 'bg-white text-body/40'}`}>
                          <FinishingIcon name={addon.name} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-bold ${addon.available ? '' : 'text-body/60'}`}>{addon.name}</span>
                          <span className="block text-xs text-body mt-0.5">
                            {!addon.available ? 'Not available yet' : addon.description || perWord(addon.unit)}
                          </span>
                        </span>
                        {addon.available && (
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-extrabold text-farhat">
                              {free ? 'Free' : `GHS ${Number(addon.price).toFixed(2)}`}
                            </span>
                            {!free && <span className="block text-[0.65rem] text-body">{perWord(addon.unit)}</span>}
                          </span>
                        )}
                      </button>
                      {askPacking && (
                        <div role="radiogroup" aria-label={`${addon.name}: how many`}
                             className="mt-1.5 flex gap-1 p-1 rounded-xl bg-[#f3f1ec]">
                          {[{ value: false, label: 'One for all copies' }, { value: true, label: 'One per copy' }].map(opt => {
                            const picked = packingFor(addon.id) === opt.value
                            return (
                              <button key={opt.label} type="button" role="radio" aria-checked={picked}
                                      onClick={() => setPerCopy(prev => ({ ...prev, [addon.id]: opt.value }))}
                                      className={`flex-1 py-2 rounded-lg text-xs font-semibold
                                                  ${picked ? 'bg-white text-ink shadow-sm' : 'text-body'}`}>
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {quote?.minimum_applied && (
            <div className="mt-5 rounded-2xl bg-[#f7f6f3] px-4 py-3 text-xs leading-relaxed text-body">
              <p>
                Our smallest order is GHS {quote.minimum}, and your size is printed exactly as you entered it.
                {quote.covers_up_to > (Number(quantity) || 1) && (
                  <> That GHS {quote.minimum} already covers up to{' '}
                  <strong className="text-ink">{quote.covers_up_to} pieces</strong> this size.</>
                )}
              </p>
              {quote.covers_up_to > (Number(quantity) || 1) && (
                <button type="button" onClick={() => setQuantity(quote.covers_up_to)}
                        className="mt-2 px-3 py-1.5 rounded-lg border border-ink text-xs font-semibold text-ink">
                  Make it {quote.covers_up_to}
                </button>
              )}
            </div>
          )}

          {problem && <p className="mt-4 text-sm text-farhat">{problem}</p>}

          <div className="mt-5 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-farhat/5 text-farhat text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" className="w-5 h-5 shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
            Prices update as you customise.
          </div>
        </div>
      </main>

      {/* The total, held at the bottom. */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white rounded-t-3xl shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-md mx-auto px-4 pt-3 pb-3">
          {breakdown && batchMode && batchReady.length > 0 && (
            <div className="mb-2 pb-2 border-b border-[#ece9e3] space-y-1 text-xs text-body">
              {batchReady.map(item => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span className="truncate">{item.file.name}</span>
                  <span className="tabular-nums shrink-0">{batchPrices[item.id] ? `GHS ${batchPrices[item.id]}` : '…'}</span>
                </div>
              ))}
            </div>
          )}
          {breakdown && !batchMode && quote && (
            <div className="mb-2 pb-2 border-b border-[#ece9e3] space-y-1 text-xs text-body">
              <div className="flex justify-between gap-3">
                <span>{product.name}{variants.length > 1 ? ` · ${service.label}` : ''}</span>
                <span className="tabular-nums">GHS {quote.base_total ?? quote.total}</span>
              </div>
              {(quote.addons || []).map(a => (
                <div key={a.service} className="flex justify-between gap-3">
                  <span>+ {a.service_name}{a.detail ? ` (${a.detail})` : ''} × {a.quantity}</span>
                  <span className="tabular-nums">GHS {a.total}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-xs text-body">
                {comingSoon ? 'Not available yet'
                  : batchMode ? (batchReady.length
                      ? `Total (${batchReady.length} file${batchReady.length === 1 ? '' : 's'} · ${copies} ${unit} each)`
                      : 'Add your files to see the total')
                  : waitingForFile ? 'Upload your file to see the total'
                  : `Total (${Number(quantity) || 1} ${unit})`}
              </p>
              <p className="text-2xl font-extrabold text-farhat tabular-nums transition-opacity"
                 style={{ opacity: pricing ? 0.45 : 1 }}>
                {shownTotal ? `GHS ${shownTotal}` : '—'}
              </p>
            </div>
            {(batchMode ? batchReady.length > 0 : quote) && (
              <button onClick={() => setBreakdown(b => !b)} aria-label="Show the breakdown"
                      className="w-9 h-9 grid place-items-center text-body">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                     strokeLinecap="round" strokeLinejoin="round"
                     className={`w-5 h-5 transition-transform ${breakdown ? 'rotate-180' : ''}`} aria-hidden="true">
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </button>
            )}
            <button disabled={!canContinue} onClick={() => handleContinue('checkout')}
                    className={`ml-auto flex-1 max-w-[190px] inline-flex items-center justify-center gap-2 py-3.5
                                rounded-2xl text-sm font-bold
                                ${canContinue ? 'bg-farhat text-white' : 'bg-[#f3f1ec] text-body/70'}`}>
              <span className="truncate">{continueLabel}</span>
              {canContinue && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                     strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </div>
          {canContinue && (
            <button onClick={() => handleContinue('catalogue')}
                    className="mt-2 w-full text-center text-xs font-semibold text-body underline underline-offset-4">
              Add to cart and keep shopping
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
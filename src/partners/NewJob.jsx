// src/partners/NewJob.jsx
//
// /partners/new: pick what it is from our catalogue, the size and quantity,
// the partner's own reference; the server prices it at the trade price; the
// file goes up and is checked before payment ("we print what you send");
// then Paystack. Collected at Westland, packed plain.

import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Shell from './Shell.jsx'
import usePartner from './usePartner'
import { money, problem, startPartnerOrder } from './api'
import { acceptWarning, getBranchOptions, getCatalogue, startPayment, updateOrder, uploadFile } from '../api/client'

const input = 'w-full h-12 rounded-xl border border-rule px-4 text-[16px] text-ink bg-white placeholder:text-body/50 focus:outline-none focus:border-farhat'
const label = 'block text-sm text-body mb-1.5'
const btn = 'h-12 px-6 rounded-xl bg-farhat text-white font-semibold disabled:opacity-60'

function services(catalogue) {
  const out = []
  for (const item of catalogue || []) {
    const versions = item.variants?.length ? item.variants : [item]
    for (const v of versions) {
      if (!v.available || v.counts_pages) continue
      out.push({ ...v, label: item.variants?.length ? `${item.name} · ${v.label}` : item.name })
    }
  }
  return out
}

export default function NewJob() {
  const { loading, partner, signOut } = usePartner()
  const [catalogue, setCatalogue] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [addons, setAddons] = useState([])
  const [reference, setReference] = useState('')
  const [order, setOrder] = useState(null)        // {order_number, access_token}
  const [priced, setPriced] = useState(null)      // the storefront's order payload
  const [file, setFile] = useState(null)          // the file check
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { getCatalogue().then(({ data }) => setCatalogue(services(data))).catch(() => setError('The catalogue didn\'t load. Refresh to try again.')) }, [])
  const service = useMemo(() => catalogue.find(s => String(s.id) === String(serviceId)), [catalogue, serviceId])
  const byArea = service?.unit === 'PER_SQFT'
  const ready = service && Number(quantity) > 0 && (!byArea || (Number(width) > 0 && Number(height) > 0))

  if (!loading && (!partner || partner.status !== 'APPROVED')) return <Navigate to="/partners" replace />

  const price = async () => {
    setBusy('price'); setError('')
    try {
      let current = order
      if (!current) {
        const { data } = await startPartnerOrder(reference)
        current = { order_number: data.order_number, access_token: data.access_token }
        setOrder(current)
      }
      const specifications = byArea ? { width_in: Number(width) * 12, height_in: Number(height) * 12 } : {}
      const line = { service: service.id, quantity: Number(quantity), specifications,
                     addons: addons.map(id => ({ service: id, quantity: 1 })) }
      const { data } = await updateOrder(current.order_number, current.access_token, { line_items: [line] })
      setPriced(data)
      setFile(null)
    } catch (e) { setError(problem(e, 'We couldn\'t price that. Check the size and try again.')) }
    setBusy('')
  }

  const upload = async picked => {
    if (!picked || !priced) return
    setBusy('file'); setError(''); setProgress(0)
    try {
      const lineId = priced.line_items?.[0]?.id
      const { data } = await uploadFile(order.order_number, order.access_token, picked, lineId, setProgress)
      setFile(data)
    } catch (e) { setError(problem(e, 'The file didn\'t upload. Try again.')) }
    setBusy('')
  }

  const accept = async () => {
    try {
      await acceptWarning(order.order_number, order.access_token, priced.line_items?.[0]?.id)
      setFile(f => ({ ...f, warning_accepted: true }))
    } catch (e) { setError(problem(e)) }
  }

  const pay = async () => {
    setBusy('pay'); setError('')
    try {
      const { data: where } = await getBranchOptions(order.order_number, order.access_token)
      const option = (where.options || []).find(o => /westland/i.test(o.branch_name)) || where.options?.[0]
      if (!option) throw new Error('none')
      await updateOrder(order.order_number, order.access_token, { branch: option.branch_id })
      const back = `${window.location.origin}/partners?paid=${order.order_number}`
      const { data } = await startPayment(order.order_number, order.access_token, back)
      window.location.assign(data.authorization_url)
    } catch (e) {
      setError(e?.message === 'none' ? 'Westland can\'t take this job right now. Message us on WhatsApp.' : problem(e))
      setBusy('')
    }
  }

  const fileOk = file && (file.verdict === 'fine' || file.warning_accepted)
  const notes = (file?.checks || []).map(c => (typeof c === 'string' ? c : c.message || c.label)).filter(Boolean)

  return (
    <Shell partner={partner} onSignOut={signOut}>
      <h1 className="text-[1.6rem] sm:text-[1.8rem] font-bold text-ink">Send a new job</h1>
      <p className="text-body">Pick what it is and the size. We price it straight away, then you add the file.</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="rounded-2xl border border-rule bg-white p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>What is it?</label>
              <select className={input} value={serviceId} onChange={e => { setServiceId(e.target.value); setAddons([]); setPriced(null) }}>
                <option value="">Choose from what we make</option>
                {catalogue.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            {byArea && (
              <>
                <div><label className={label}>Width (ft)</label><input className={input} inputMode="decimal" value={width} onChange={e => { setWidth(e.target.value); setPriced(null) }} placeholder="6" /></div>
                <div><label className={label}>Height (ft)</label><input className={input} inputMode="decimal" value={height} onChange={e => { setHeight(e.target.value); setPriced(null) }} placeholder="3" /></div>
              </>
            )}
            <div><label className={label}>Quantity</label><input className={input} inputMode="numeric" value={quantity} onChange={e => { setQuantity(e.target.value.replace(/\D/g, '')); setPriced(null) }} /></div>
            {service?.addons?.some(a => a.available) && (
              <div className="sm:col-span-2">
                <label className={label}>Finishing</label>
                <div className="flex flex-wrap gap-2">
                  {service.addons.filter(a => a.available).map(a => {
                    const on = addons.includes(a.id)
                    return <button key={a.id} type="button" onClick={() => { setAddons(on ? addons.filter(x => x !== a.id) : [...addons, a.id]); setPriced(null) }}
                                   className={`px-3.5 py-2 rounded-full text-sm border ${on ? 'bg-farhat text-white border-farhat' : 'border-rule text-ink'}`}>{a.name}</button>
                  })}
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={label}>Your reference <span className="text-body/60">(only you see it, and it goes on the label)</span></label>
              <input className={input} value={reference} onChange={e => setReference(e.target.value)} placeholder="Mensah wedding banner" disabled={!!order} />
            </div>
          </div>
          <button className={`${btn} mt-5`} disabled={!ready || busy === 'price'} onClick={price}>{busy === 'price' ? 'Pricing…' : priced ? 'Price it again' : 'Price it'}</button>

          {priced && (
            <div className="mt-6 border-t border-rule pt-5">
              <label className={label}>The file to print</label>
              <label className={`flex items-center gap-4 rounded-2xl border-2 border-dashed p-4 cursor-pointer ${file ? 'border-farhat/40 bg-farhat/5' : 'border-rule'}`}>
                <span className="w-12 h-12 rounded-xl bg-white grid place-items-center text-2xl">📄</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-ink truncate">{file?.filename || 'Choose the print-ready file'}</span>
                  <span className="block text-sm text-body">{busy === 'file' ? `Uploading… ${progress}%` : file ? (file.verdict === 'fine' ? 'Print-ready ✓' : 'Check the notes below') : 'PDF, JPG or PNG'}</span>
                </span>
                <input type="file" className="hidden" accept=".pdf,image/*" onChange={e => upload(e.target.files?.[0])} />
              </label>
              {file && file.verdict !== 'fine' && (
                <div className="mt-3 rounded-xl bg-gold/15 p-3 text-sm text-ink">
                  {notes.length ? notes.map(n => <p key={n}>{n}</p>) : <p>This file may not print well at this size.</p>}
                  {!file.warning_accepted
                    ? <button className="mt-2 text-farhat font-semibold" onClick={accept}>Print it as it is, my choice</button>
                    : <p className="mt-2 text-body">You've chosen to print it as it is.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-rule bg-white p-5 sm:p-6 h-fit">
          <p className="font-semibold text-ink">Price</p>
          {!priced ? (
            <p className="mt-2 text-sm text-body">Choose what it is and the size, then Price it. Partners pay 6% under walk-in; your first job is 10% off.</p>
          ) : (
            <>
              <div className="mt-3 space-y-1.5 text-[15px]">
                <div className="flex justify-between"><span className="text-body">Walk-in price</span><span className="text-body line-through">{money(priced.full_total)}</span></div>
                {Number(priced.discount_amount) > 0 && (
                  <div className="flex justify-between gap-3"><span className="text-farhat font-semibold">{priced.discount_reason}</span><span className="text-farhat font-semibold whitespace-nowrap">− {money(priced.discount_amount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-body">Payment fee (Paystack)</span><span className="text-body">{money(priced.processing_fee)}</span></div>
              </div>
              <div className="mt-3 pt-3 border-t border-rule flex justify-between items-end"><span className="text-ink font-semibold">You pay</span><span className="text-3xl font-extrabold text-ink">{money(priced.total)}</span></div>
              <div className="mt-4 rounded-xl bg-substrate p-3 text-sm space-y-1">
                <p className="text-body">📦 Packed plain, labelled {partner?.code}</p>
                <p className="text-body">📍 Collect at Westland. We'll tell you the ready time when you pay.</p>
              </div>
              <button className={`${btn} w-full mt-4`} disabled={!fileOk || busy === 'pay'} onClick={pay}>
                {busy === 'pay' ? 'Opening payment…' : fileOk ? `Pay ${money(priced.total)}` : 'Add the file to pay'}
              </button>
            </>
          )}
          {error && <p className="mt-3 text-sm text-farhat">{error}</p>}
        </aside>
      </div>
    </Shell>
  )
}

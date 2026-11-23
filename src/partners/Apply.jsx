// src/partners/Apply.jsx
//
// /partners/apply: four steps (your shop, contacts and rep, services, terms),
// with a live preview of the profile banner from the shop photo and logo.
// Both numbers are confirmed with a code. While sign-ups are closed, only a
// shop with an invite code (?invite=… or typed) can send it.

import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TopBar } from './Shell.jsx'
import { apply, applyCode, partnersOpen, problem } from './api'

const REGIONS = ['Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Western', 'Western North', 'Volta', 'Oti',
  'Northern', 'Savannah', 'North East', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo']
const STEPS = ['Your shop', 'Contacts and rep', 'Services', 'Terms']
const TERMS = [
  'You pay for each job in full before we print it, plus the payment fee.',
  'Collect from Westland within 7 days. Your rider can collect with the job\'s code.',
  'We print what you send. We show any problem with a file before you pay, and you confirm.',
  'Report a problem with a photo within 48 hours of collecting. Reprints are free when it\'s our fault.',
  'Only send work you\'re allowed to print: no fake documents, no copies of other brands\' designs. We can refuse a job.',
  'We keep your files for 30 days, unless you ask us to keep one longer, then delete them. We never contact your customers.',
  'We tell you 7 days before any price change.',
]

const input = 'w-full h-12 rounded-xl border border-rule px-4 text-[16px] text-ink bg-white placeholder:text-body/50 focus:outline-none focus:border-farhat'
const label = 'block text-sm text-body mb-1.5'
const btn = 'h-12 px-6 rounded-xl bg-farhat text-white font-semibold disabled:opacity-60'

function Field({ title, hint, children, wide }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><label className={label}>{title}{hint && <span className="text-body/60"> ({hint})</span>}</label>{children}</div>
}

function Phone({ value, onChange, code, onCode, invite, confirmedLabel }) {
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const send = async () => {
    setError('')
    try { const { data } = await applyCode(value, invite); setSent(data.sent_to) } catch (e) { setError(problem(e)) }
  }
  return (
    <div>
      <div className="flex gap-2">
        <input className={input} inputMode="tel" value={value} onChange={e => { onChange(e.target.value); setSent('') }} placeholder="024 000 0000" />
        <button type="button" className="h-12 px-4 rounded-xl border border-farhat text-farhat font-semibold whitespace-nowrap" onClick={send} disabled={value.length < 9}>
          {sent ? 'Resend' : 'Send code'}
        </button>
      </div>
      {sent && (
        <div className="mt-2">
          <p className="text-xs text-body mb-1">Code sent to {sent}{confirmedLabel ? `: ${confirmedLabel}` : ''}</p>
          <input className={`${input} tracking-[0.4em] font-bold`} inputMode="numeric" maxLength={6} placeholder="6-digit code"
                 value={code} onChange={e => onCode(e.target.value.replace(/\D/g, ''))} />
        </div>
      )}
      {error && <p className="mt-1 text-sm text-farhat">{error}</p>}
    </div>
  )
}

export default function Apply() {
  const [params] = useSearchParams()
  const [info, setInfo] = useState(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [f, setF] = useState({
    invite: params.get('invite') || '', name: '', kind: 'PRINT_SHOP', registered_name: '', registration_number: '',
    tin: '', region: 'Greater Accra', area: '', gps_address: '', landmark: '', opening_hours: '',
    latitude: '', longitude: '', primary_phone: '', primary_code: '', secondary_phone: '', email: '',
    rep_title: 'Mr', rep_first_name: '', rep_last_name: '', rep_role: 'OWNER', rep_same: true,
    rep_phone: '', rep_code: '', services: [], monthly_volume: '', heard_from: '', accept_terms: false,
    messages_consent: true,
  })
  const [shop, setShop] = useState(null)
  const [logo, setLogo] = useState(null)
  const set = (k, v) => setF(old => ({ ...old, [k]: v }))
  const shopUrl = useMemo(() => (shop ? URL.createObjectURL(shop) : ''), [shop])
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : ''), [logo])

  useEffect(() => {
    partnersOpen(f.invite).then(({ data }) => setInfo(data)).catch(() => setInfo({ open: false, services: [] }))
  }, [f.invite])

  const locate = () => navigator.geolocation?.getCurrentPosition(
    p => { set('latitude', p.coords.latitude.toFixed(6)); set('longitude', p.coords.longitude.toFixed(6)) },
    () => setError('We couldn\'t get your location. Type the GPS address instead.'))

  const ready = [
    f.name && f.area && f.gps_address && f.landmark && shop && logo,
    f.primary_phone && f.primary_code.length === 6 && f.rep_first_name && f.rep_last_name &&
      (f.rep_same || (f.rep_phone && f.rep_code.length === 6)),
    f.services.length > 0 && f.monthly_volume,
    f.accept_terms,
  ]

  const submit = async () => {
    setBusy(true); setError('')
    const form = new FormData()
    const fields = { ...f, services: f.services.join(','), accept_terms: 'true', messages_consent: f.messages_consent ? 'true' : '' }
    if (f.rep_same) { fields.rep_phone = f.primary_phone; fields.rep_code = f.primary_code }
    delete fields.rep_same
    Object.entries(fields).forEach(([k, v]) => form.append(k, v ?? ''))
    form.append('shop_photo', shop)
    form.append('logo', logo)
    try { await apply(form); setDone(true) } catch (e) {
      setError(problem(e))
      const field = e?.response?.data?.field || ''
      if (/code|phone|rep_/.test(field)) setStep(1)
      else if (/services|monthly/.test(field)) setStep(2)
      else if (field && !/accept|invite/.test(field)) setStep(0)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#faf8f5]"><TopBar label="Printing Press" />
        <div className="max-w-xl mx-auto px-4 py-12 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-50 grid place-items-center text-4xl text-emerald-600">✓</div>
          <h1 className="mt-4 text-2xl font-bold text-ink">Application sent</h1>
          <p className="text-body mt-2">Farhat reviews every shop, usually within one working day. We'll message you on WhatsApp.</p>
          <Link to="/partners" className={`${btn} inline-grid place-items-center mt-6`}>Sign in to follow it</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <TopBar label="Printing Press" />
      <div className="bg-farhat">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2">
          <p className="text-white/80 text-sm">Become a trade partner</p>
          <h1 className="text-white text-[1.9rem] sm:text-[2.2rem] font-bold leading-tight">Print what your shop <span className="text-gold">can't.</span></h1>
          <p className="text-white/85">6% under walk-in on every job, 10% off your first. Your customer stays yours.</p>
        </div>
        <div className="h-8 bg-[#faf8f5] rounded-t-[32px] translate-y-px" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-rule bg-white p-5 sm:p-6">
          {info && !info.open && (
            <div className="mb-5 rounded-xl bg-farhat/5 border border-farhat/20 p-4">
              <p className="font-semibold text-ink">Partner sign-ups open soon</p>
              <p className="text-sm text-body">If Farhat gave you an invite code, enter it to apply now.</p>
              <input className={`${input} mt-2 uppercase`} value={f.invite} onChange={e => set('invite', e.target.value)} placeholder="Invite code" />
            </div>
          )}
          <div className="flex gap-4 sm:gap-6 text-sm mb-5 border-b border-rule pb-3 overflow-x-auto">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i <= step && setStep(i)} className={`whitespace-nowrap ${i === step ? 'text-farhat font-semibold' : i < step ? 'text-ink' : 'text-body'}`}>{i + 1} · {s}</button>
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Business name" wide><input className={input} value={f.name} onChange={e => set('name', e.target.value)} placeholder="As on your signboard" /></Field>
              <Field title="Type of business">
                <select className={input} value={f.kind} onChange={e => set('kind', e.target.value)}>
                  {(info?.kinds || []).map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </Field>
              <Field title="Registration number" hint="if you have one"><input className={input} value={f.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="BN0000000" /></Field>
              <Field title="Region">
                <select className={input} value={f.region} onChange={e => set('region', e.target.value)}>{REGIONS.map(r => <option key={r}>{r}</option>)}</select>
              </Field>
              <Field title="Town or area"><input className={input} value={f.area} onChange={e => set('area', e.target.value)} placeholder="Madina" /></Field>
              <Field title="Ghana Post GPS"><input className={`${input} uppercase`} value={f.gps_address} onChange={e => set('gps_address', e.target.value)} placeholder="GA-402-1187" /></Field>
              <Field title="Landmark"><input className={input} value={f.landmark} onChange={e => set('landmark', e.target.value)} placeholder="Opposite the Total filling station" /></Field>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3 text-sm">
                <button type="button" onClick={locate} className="text-farhat font-semibold">📍 Use my shop's location</button>
                <span className="text-body">{f.latitude ? `Pinned: ${f.latitude}, ${f.longitude}` : 'Best done standing at your shop'}</span>
              </div>
              <Field title="Shop front photo">
                <label className="block h-28 rounded-xl border-2 border-dashed border-rule bg-substrate/50 overflow-hidden cursor-pointer">
                  {shopUrl ? <img src={shopUrl} alt="" className="w-full h-full object-cover" /> : <span className="h-full grid place-items-center text-sm text-body">📷 Add a photo, so we know it's real</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setShop(e.target.files?.[0] || null)} />
                </label>
              </Field>
              <Field title="Your logo">
                <label className="block h-28 rounded-xl border-2 border-dashed border-rule bg-substrate/50 overflow-hidden cursor-pointer">
                  {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-contain p-2 bg-white" /> : <span className="h-full grid place-items-center text-sm text-body">Your best logo file (PNG or a clear photo)</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setLogo(e.target.files?.[0] || null)} />
                </label>
              </Field>
              <Field title="Opening hours" hint="optional" wide><input className={input} value={f.opening_hours} onChange={e => set('opening_hours', e.target.value)} placeholder="Mon–Sat 8am–7pm" /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Shop's main number" hint="gets job alerts" wide>
                <Phone value={f.primary_phone} onChange={v => set('primary_phone', v)} code={f.primary_code} onCode={v => set('primary_code', v)} invite={f.invite} />
              </Field>
              <Field title="Second number" hint="optional"><input className={input} inputMode="tel" value={f.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} /></Field>
              <Field title="Email" hint="optional"><input className={input} type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
              <p className="sm:col-span-2 font-semibold text-ink mt-2">You, the rep</p>
              <Field title="Title">
                <select className={input} value={f.rep_title} onChange={e => set('rep_title', e.target.value)}>{(info?.titles || ['Mr', 'Mrs', 'Ms']).map(t => <option key={t}>{t}</option>)}</select>
              </Field>
              <Field title="Your role">
                <select className={input} value={f.rep_role} onChange={e => set('rep_role', e.target.value)}>{(info?.roles || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              </Field>
              <Field title="First name"><input className={input} value={f.rep_first_name} onChange={e => set('rep_first_name', e.target.value)} /></Field>
              <Field title="Last name"><input className={input} value={f.rep_last_name} onChange={e => set('rep_last_name', e.target.value)} /></Field>
              <label className="sm:col-span-2 flex gap-2 items-center text-sm text-ink">
                <input type="checkbox" checked={f.rep_same} onChange={e => set('rep_same', e.target.checked)} /> I'll sign in with the shop's main number
              </label>
              {!f.rep_same && (
                <Field title="Your own number" hint="you sign in with it" wide>
                  <Phone value={f.rep_phone} onChange={v => set('rep_phone', v)} code={f.rep_code} onCode={v => set('rep_code', v)} invite={f.invite} />
                </Field>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-body">What would you send us? Pick from what we make.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(info?.services || []).map(s => {
                  const on = f.services.includes(s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => set('services', on ? f.services.filter(x => x !== s.id) : [...f.services, s.id])}
                            className={`px-3.5 py-2 rounded-full text-sm border ${on ? 'bg-farhat text-white border-farhat' : 'border-rule text-ink'}`}>{s.name}</button>
                  )
                })}
              </div>
              <p className="text-sm text-body mt-6">Roughly how many jobs a month?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(info?.volumes || []).map(v => (
                  <button key={v.id} type="button" onClick={() => set('monthly_volume', v.id)}
                          className={`px-3.5 py-2 rounded-full text-sm border ${f.monthly_volume === v.id ? 'bg-farhat text-white border-farhat' : 'border-rule text-ink'}`}>{v.name}</button>
                ))}
              </div>
              <div className="mt-6 max-w-md"><Field title="How did you hear about us?" hint="optional"><input className={input} value={f.heard_from} onChange={e => set('heard_from', e.target.value)} /></Field></div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="font-semibold text-ink">The partner terms</p>
              <ul className="mt-3 space-y-2 text-sm text-ink list-disc pl-5">{TERMS.map(t => <li key={t}>{t}</li>)}</ul>
              <label className="mt-5 flex gap-3 text-sm text-ink"><input type="checkbox" checked={f.accept_terms} onChange={e => set('accept_terms', e.target.checked)} /> I agree to the partner terms.</label>
              <label className="mt-2 flex gap-3 text-sm text-ink"><input type="checkbox" checked={f.messages_consent} onChange={e => set('messages_consent', e.target.checked)} /> Farhat may message us on WhatsApp and by text about our jobs.</label>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-farhat">{error}</p>}
          <div className="mt-6 flex justify-between gap-3">
            {step > 0 ? <button className="h-12 px-5 rounded-xl border border-rule text-ink" onClick={() => setStep(step - 1)}>Back</button> : <span />}
            {step < 3
              ? <button className={btn} disabled={!ready[step]} onClick={() => { setError(''); setStep(step + 1) }}>Next: {STEPS[step + 1].toLowerCase()}</button>
              : <button className={btn} disabled={!ready.every(Boolean) || busy} onClick={submit}>{busy ? 'Sending…' : 'Send my application'}</button>}
          </div>
        </div>

        <aside className="space-y-4">
          <div>
            <p className="text-sm text-body mb-2">How your profile will look</p>
            <div className="relative h-40 rounded-3xl overflow-hidden bg-ink">
              {shopUrl && <img src={shopUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-end gap-3">
                {logoUrl ? <img src={logoUrl} alt="" className="w-14 h-14 rounded-xl bg-white p-1 object-contain" /> : <span className="w-14 h-14 rounded-xl bg-white/20" />}
                <div><p className="text-white font-bold">{f.name || 'Your shop'}</p><p className="text-white/80 text-xs">{f.area || 'Your area'}</p></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-substrate p-4 text-sm text-body space-y-2">
            <p className="text-ink font-semibold">What happens next</p>
            <p>1. We confirm your numbers with a code.</p>
            <p>2. Farhat reviews your shop, usually within one working day.</p>
            <p>3. You get your partner ID, like <b className="text-ink">MAD·K7Q2</b>, and 10% off your first job.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

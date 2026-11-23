// src/partners/Home.jsx
//
// /partners: sign in with the rep's number and a code; then the application's
// progress while Farhat reviews it, or the dashboard once approved.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Shell, { TopBar } from './Shell.jsx'
import { money, problem, saveToken, signInCode, signInVerify } from './api'
import usePartner from './usePartner'

const input = 'w-full h-12 rounded-xl border border-rule px-4 text-[16px] text-ink bg-white placeholder:text-body/50 focus:outline-none focus:border-farhat'
const btn = 'h-12 px-6 rounded-xl bg-farhat text-white font-semibold disabled:opacity-60'

function SignIn({ onIn, notPartner }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    setBusy(true); setError('')
    try { await signInCode(phone); setSent(true) } catch (e) { setError(problem(e)) }
    setBusy(false)
  }
  const verify = async () => {
    setBusy(true); setError('')
    try {
      const { data } = await signInVerify(phone, code)
      saveToken(data.token)
      onIn()
    } catch (e) { setError(problem(e)) }
    setBusy(false)
  }
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <TopBar />
      <div className="bg-farhat">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2">
          <h1 className="text-white text-[1.9rem] sm:text-[2.2rem] font-bold leading-tight">Print what your shop <span className="text-gold">can't.</span></h1>
          <p className="text-white/85">Farhat trade partners: 6% under walk-in on every job. Your customer stays yours.</p>
        </div>
        <div className="h-8 bg-[#faf8f5] rounded-t-[32px] translate-y-px" />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 grid gap-6 md:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-rule bg-white p-6 max-w-xl">
          <h2 className="text-xl font-bold text-ink">Sign in</h2>
          <p className="text-body text-sm mt-1">With the number you registered as the shop's rep. We'll send a code.</p>
          {notPartner && (
            <p className="mt-4 rounded-xl bg-farhat/5 border border-farhat/20 p-3 text-sm text-ink">
              That number isn't on a partner account. <Link to="/partners/apply" className="text-farhat font-semibold">Apply to be a partner</Link>.
            </p>
          )}
          <label className="block text-sm text-body mt-5 mb-1.5">Your number</label>
          <input className={input} inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="024 000 0000" disabled={sent} />
          {sent && (
            <>
              <label className="block text-sm text-body mt-4 mb-1.5">The 6-digit code</label>
              <input className={`${input} tracking-[0.4em] font-bold`} inputMode="numeric" maxLength={6} value={code}
                     onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </>
          )}
          {error && <p className="mt-3 text-sm text-farhat">{error}</p>}
          <button className={`${btn} w-full mt-5`} disabled={busy || (sent ? code.length !== 6 : phone.length < 9)}
                  onClick={sent ? verify : send}>{busy ? 'One moment…' : sent ? 'Sign in' : 'Send me a code'}</button>
          {sent && <button className="mt-3 text-sm text-body" onClick={() => { setSent(false); setCode('') }}>Use another number</button>}
        </div>
        <aside className="rounded-2xl bg-substrate p-5 text-sm text-body h-fit">
          <p className="text-ink font-semibold">Not a partner yet?</p>
          <p className="mt-1">Print shops, business centres and cyber cafés send us the work their machines can't do. Your first job is 10% off.</p>
          <Link to="/partners/apply" className="inline-block mt-3 text-farhat font-semibold">Apply to be a partner →</Link>
        </aside>
      </div>
    </div>
  )
}

function Waiting({ partner, onSignOut }) {
  const asked = partner.status === 'ASKED'
  const closed = ['DECLINED', 'CLOSED', 'REMOVED'].includes(partner.status)
  const steps = [
    ['done', 'Numbers confirmed', 'By WhatsApp code'],
    ['done', 'Shop details and photo', `${partner.name}, ${partner.area}`],
    [closed ? 'stop' : 'now', asked ? 'Farhat asked a question' : 'Farhat is reviewing',
     asked ? 'Reply on WhatsApp to carry on' : 'Usually within one working day'],
    ['wait', 'Your account opens', 'With 10% off your first job'],
  ]
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <TopBar partner={partner} onSignOut={onSignOut} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-[1.6rem] font-bold text-ink">{closed ? 'Application closed' : 'Application sent'}</h1>
        <p className="text-body">{closed ? partner.status_label : "We'll message you on WhatsApp the moment it's done."}</p>
        {asked && partner.asked_for && (
          <div className="mt-5 rounded-2xl bg-farhat/5 border border-farhat/20 p-4">
            <p className="text-sm text-body">Farhat asked</p>
            <p className="text-ink mt-1">{partner.asked_for}</p>
          </div>
        )}
        <ol className="mt-6 rounded-2xl border border-rule bg-white p-5">
          {steps.map(([s, t, d], i) => (
            <li key={t} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`w-6 h-6 rounded-full grid place-items-center text-xs ${s === 'done' ? 'bg-emerald-600 text-white' : s === 'now' ? 'border-2 border-farhat' : 'border-2 border-rule'}`}>
                  {s === 'done' ? '✓' : s === 'now' ? <span className="w-2 h-2 rounded-full bg-farhat" /> : ''}
                </span>
                {i < steps.length - 1 && <span className={`w-0.5 flex-1 my-1 ${s === 'done' ? 'bg-emerald-600' : 'bg-rule'}`} />}
              </div>
              <div className="pb-5"><p className={`font-semibold ${s === 'wait' ? 'text-body' : 'text-ink'}`}>{t}</p><p className="text-sm text-body">{d}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

const TONES = {
  ready: 'bg-emerald-50 text-emerald-700', printing: 'bg-gold/25 text-[#7a5a00]', production: 'bg-gold/25 text-[#7a5a00]',
  finishing: 'bg-gold/25 text-[#7a5a00]', collected: 'bg-white text-body border border-rule', cancelled: 'bg-white text-body border border-rule',
}

function Bar({ label, done, of }) {
  return (
    <div>
      <div className="flex justify-between text-sm gap-3"><span className="text-ink">{label}</span><span className="text-body whitespace-nowrap">{done} of {of} jobs</span></div>
      <div className="mt-1.5 h-2 rounded-full bg-substrate overflow-hidden"><div className="h-full bg-farhat rounded-full" style={{ width: `${Math.min(100, (done / of) * 100)}%` }} /></div>
    </div>
  )
}

function Dashboard({ partner, onSignOut }) {
  const navigate = useNavigate()
  const [greet] = useState(() => {
    const hour = new Date().getHours()
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  })
  const { stats = {}, rewards, jobs = [], ready = [] } = partner
  const paused = partner.status === 'PAUSED'
  return (
    <Shell partner={partner} onSignOut={onSignOut}>
      <div className="relative h-36 sm:h-40 rounded-3xl overflow-hidden bg-ink">
        {partner.shop_photo && <img src={partner.shop_photo} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
        <div className="relative h-full flex items-end gap-4 p-4 sm:p-5">
          {partner.logo && <img src={partner.logo} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1 ring-4 ring-white object-contain" />}
          <div className="pb-1 min-w-0">
            <p className="text-white text-xl sm:text-2xl font-bold leading-tight truncate">{partner.name}</p>
            <p className="text-white/85 text-sm truncate">{partner.area}, near {partner.landmark}</p>
          </div>
          <span className="ml-auto mb-1 px-3 py-1.5 rounded-full bg-gold text-ink text-xs font-bold shrink-0">{partner.code}</span>
        </div>
      </div>

      {paused && <p className="mt-4 rounded-xl bg-farhat/5 border border-farhat/20 p-3 text-sm text-ink">Your account is paused. Jobs you've paid for carry on as normal; new jobs can't be sent for now.</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body">{greet}, {partner.rep?.first_name}.{ready.length ? <span className="text-ink"> {ready.length === 1 ? 'One job is' : `${ready.length} jobs are`} ready to collect.</span> : ''}</p>
        {!paused && <button className={btn} onClick={() => navigate('/partners/new')}>+ Send a new job</button>}
      </div>

      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[[stats.printing ?? 0, 'Printing now'], [stats.ready ?? 0, 'Ready to collect', true], [rewards?.jobs ?? 0, 'Jobs so far'], [money(stats.saved_this_month), 'Saved this month']].map(([v, k, accent]) => (
          <div key={k} className="rounded-2xl border border-rule bg-white p-4"><p className={`text-xl sm:text-2xl font-extrabold ${accent ? 'text-farhat' : 'text-ink'}`}>{v}</p><p className="text-sm text-body">{k}</p></div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_290px]">
        <div className="rounded-2xl border border-rule bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-rule"><p className="font-semibold text-ink">Your jobs</p></div>
          {jobs.length === 0 ? (
            <p className="px-5 py-8 text-body text-sm">No jobs yet. Your first one is 10% off.</p>
          ) : (
            <ul>
              {jobs.map(j => (
                <li key={j.order_number} className="px-5 py-3 border-t border-rule first:border-t-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{j.reference || j.summary}</p>
                    <p className="text-sm text-body truncate">{j.summary}{j.detail ? ` · ${j.detail}` : ''}{j.job_number ? ` · ${j.job_number}` : ''}</p>
                  </div>
                  <div className="flex sm:block items-center justify-between gap-3 sm:text-right shrink-0">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${TONES[j.stage] || 'bg-substrate text-body'}`}>
                      {j.stage_label}{j.ready_about ? ` · ${j.ready_about}` : ''}
                    </span>
                    <p className="text-sm text-ink sm:mt-1">{money(j.total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-5 content-start sm:grid-cols-2 xl:grid-cols-1">
          {rewards && (
            <div className="rounded-2xl border border-rule bg-white p-5 space-y-4">
              <p className="font-semibold text-ink">Your rewards</p>
              <Bar label={rewards.wrap.earned ? '🎁 Branded wrap earned' : '🎁 Your own branded wrap'} done={rewards.wrap.done} of={rewards.wrap.at} />
              <Bar label={rewards.reward.next_is_reward ? 'Your next job is 10% off' : '10% off a job'} done={rewards.reward.done} of={rewards.reward.every} />
            </div>
          )}
          {ready.map(r => (
            <div key={r.order_number} className="rounded-2xl bg-farhat text-white p-5">
              <p className="font-semibold">Ready to collect</p>
              <p className="text-white/85 text-sm">{r.reference || r.summary} · {r.job_number}</p>
              {r.collection_code && <p className="mt-2 text-4xl font-extrabold tracking-[0.2em]">{r.collection_code}</p>}
              <p className="text-white/85 text-sm">Show this code at Westland. Your rider can too.</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}

export default function PartnersHome() {
  const { loading, partner, error, reload, signOut: out } = usePartner()
  if (loading) return <div className="min-h-screen bg-[#faf8f5]"><TopBar /></div>
  if (!partner) return <SignIn onIn={reload} notPartner={error === 'not-partner'} />
  if (['APPROVED', 'PAUSED'].includes(partner.status)) return <Dashboard partner={partner} onSignOut={out} />
  return <Waiting partner={partner} onSignOut={out} />
}

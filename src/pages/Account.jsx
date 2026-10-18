// src/pages/Account.jsx
//
// The customer's own space in the app: signing in, and once signed in,
// their details, their orders and signing out.
//
// Signing in is a phone number and a code texted to it, nothing else: no
// password to forget. A number we have not seen before is also asked for
// a first name, and that is the whole of signing up.

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { accountCode, accountOrders, accountVerify } from '../api/client'
import { useAccount } from '../lib/AccountContext.jsx'
import Header from '../components/Header.jsx'

export default function Account() {
  const { account, ready } = useAccount()
  return (
    <div className="min-h-screen bg-white text-ink">
      <Header back />
      <main className="max-w-md mx-auto px-5 py-8">
        {!ready ? null : account ? <Signed account={account} /> : <SignIn />}
      </main>
    </div>
  )
}

function SignIn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signedIn } = useAccount()

  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function send() {
    setBusy(true); setProblem('')
    try {
      const { data } = await accountCode(phone.trim())
      setSentTo(data.sent_to)
      setIsNew(data.new_customer)
      setStep('code')
    } catch (err) {
      setProblem(err.response?.data?.detail || 'We couldn’t send a code just now. Try again in a moment.')
    } finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setProblem('')
    try {
      const { data } = await accountVerify({
        phone: phone.trim(), code: code.trim(), first_name: firstName.trim(),
        device: navigator.userAgent.slice(0, 120),
      })
      await signedIn(data.token, data.account)
      navigate(params.get('next') || '/', { replace: true })
    } catch (err) {
      setProblem(err.response?.data?.detail || 'That didn’t work. Check the code and try again.')
      setBusy(false)
    }
  }

  const input = `w-full px-3 py-3 rounded-lg border border-rule bg-white text-[1rem]
                 focus:outline-none focus:border-ink`

  return (
    <div>
      <h1 className="text-xl font-bold">Sign in or create your account</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-body">
        Your number is your account. We’ll text you a code to check it’s
        yours. New here? The same code sets you up.
      </p>

      {step === 'phone' && (
        <>
          <label className="block mt-5">
            <span className="block mb-1.5 text-xs text-body">Phone number</span>
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone}
                   onChange={e => setPhone(e.target.value)} placeholder="024 000 0000"
                   onKeyDown={e => { if (e.key === 'Enter' && phone.trim()) send() }}
                   className={input} />
          </label>
          <button onClick={send} disabled={busy || !phone.trim()}
                  className="mt-4 w-full px-4 py-3 rounded-lg bg-farhat text-white text-sm
                             font-semibold disabled:opacity-40">
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          <p className="mt-5 text-sm">We texted a code to <strong>{sentTo}</strong>.</p>
          <label className="block mt-3">
            <span className="block mb-1.5 text-xs text-body">The 6-digit code</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                   value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                   className={`${input} tracking-[0.5em] text-center text-lg font-semibold`} />
          </label>
          {isNew && (
            <label className="block mt-3">
              <span className="block mb-1.5 text-xs text-body">Your first name</span>
              <input autoComplete="given-name" value={firstName}
                     onChange={e => setFirstName(e.target.value)} className={input} />
            </label>
          )}
          <button onClick={verify}
                  disabled={busy || code.length !== 6 || (isNew && !firstName.trim())}
                  className="mt-4 w-full px-4 py-3 rounded-lg bg-farhat text-white text-sm
                             font-semibold disabled:opacity-40">
            {busy ? 'Checking…' : isNew ? 'Create my account' : 'Sign in'}
          </button>
          <button onClick={() => { setStep('phone'); setCode(''); setProblem('') }}
                  className="mt-3 w-full text-sm font-semibold text-body">
            Use a different number, or send the code again
          </button>
        </>
      )}

      {problem && <p className="mt-4 text-sm text-farhat">{problem}</p>}
    </div>
  )
}

function Signed({ account }) {
  const navigate = useNavigate()
  const { signOut } = useAccount()
  const [leaving, setLeaving] = useState(false)

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-full bg-farhat text-white grid place-items-center
                         text-lg font-bold">
          {(account.first_name || '?').charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-xl font-bold">{account.first_name}</h1>
          <p className="text-sm text-body">{account.phone}</p>
        </div>
      </div>

      <MyOrders />

      <button
        onClick={async () => { setLeaving(true); await signOut(); navigate('/', { replace: true }) }}
        disabled={leaving}
        className="mt-6 w-full px-4 py-3 rounded-lg border border-rule text-sm font-semibold
                   disabled:opacity-40">
        {leaving ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}

const STAGE = {
  paid: { label: 'Paid', tone: 'bg-substrate text-body' },
  inspecting: { label: 'Being checked', tone: 'bg-substrate text-body' },
  press: { label: 'In press', tone: 'bg-amber-50 text-amber-800' },
  finishing: { label: 'Finishing', tone: 'bg-amber-50 text-amber-800' },
  ready: { label: 'Ready to collect', tone: 'bg-emerald-50 text-emerald-800' },
}

function when(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function timeLeft(e) {
  if (!e) return null
  if (e.held_up) return 'a short delay, we’re on it'
  if (e.running_over) return 'taking a little longer than usual'
  const m = Number(e.minutes_left) || 0
  if (m < 60) return `about ${m} min left`
  const h = Math.floor(m / 60)
  return `about ${h} hr${m % 60 ? ` ${m % 60} min` : ''} left`
}

/**
 * Every paid order on their number, website ones included: what is
 * being made now, and what they have collected. Tapping one opens its
 * tracking page.
 */
function MyOrders() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => accountOrders().then(r => r.data),
    // Stages move while they watch.
    refetchInterval: 60_000,
  })

  const active = data?.active || []
  const collected = data?.collected || []
  const list = tab === 'active' ? active : collected
  const open = o => navigate(`/track/${o.order_number}?t=${o.token}`)

  return (
    <section className="mt-6">
      <h2 className="text-[0.95rem] font-semibold">My orders</h2>

      <div className="mt-3 flex p-1 rounded-lg bg-substrate gap-1" role="tablist">
        {[['active', `Active · ${active.length}`], ['collected', `Collected · ${collected.length}`]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors
                              ${tab === key ? 'bg-white text-ink shadow-sm' : 'text-body'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="mt-4 text-sm text-body">Loading your orders…</p>}
      {isError && <p className="mt-4 text-sm text-farhat">Your orders didn’t load. Try again in a moment.</p>}

      {!isLoading && !isError && list.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-rule px-4 py-6 text-center">
          <p className="text-sm text-body">
            {tab === 'active' ? 'Nothing being made right now.' : 'Nothing collected yet.'}
          </p>
          <button onClick={() => navigate('/')}
                  className="mt-3 px-4 py-2 rounded-lg bg-farhat text-white text-sm font-semibold">
            Order something
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {list.map(o => {
          const stage = STAGE[o.stage]
          const left = timeLeft(o.estimate)
          return (
            <button key={o.order_number} onClick={() => open(o)}
                    className="w-full text-left rounded-xl border border-rule px-4 py-3
                               hover:border-ink transition-colors">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-snug">{o.summary}</p>
                {tab === 'active' && stage ? (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${stage.tone}`}>
                    {stage.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-semibold tabular-nums">GHS {o.total}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-body">
                {o.order_number}
                {tab === 'active'
                  ? (left ? ` · ${left}` : o.branch ? ` · ${o.branch}` : '')
                  : ` · collected ${when(o.collected_at)}`}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
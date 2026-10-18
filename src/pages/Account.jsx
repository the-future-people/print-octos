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
import { accountCode, accountVerify } from '../api/client'
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
      <h1 className="text-xl font-bold">Sign in</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-body">
        Your number is your account. We’ll text you a code to check it’s yours,
        once on this phone.
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

      <div className="mt-6 rounded-xl border border-rule divide-y divide-rule">
        <div className="px-4 py-3.5">
          <p className="text-sm font-semibold">My orders</p>
          <p className="text-xs text-body mt-0.5">Coming next: your active and collected orders.</p>
        </div>
        <button onClick={() => navigate('/')} className="w-full text-left px-4 py-3.5">
          <p className="text-sm font-semibold">Order something</p>
        </button>
      </div>

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
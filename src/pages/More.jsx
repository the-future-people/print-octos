// src/pages/More.jsx
//
// The More tab: the account, and the ways to reach the shop.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../lib/AccountContext.jsx'
import Header from '../components/Header.jsx'

// Westland's own line, as the tracking page shows it.
const BRANCH_PHONE = '0556244194'
const BRANCH_MAP = 'https://www.google.com/maps/search/?api=1&query=Farhat+Printing+Press+Westland+Accra'

function Row({ icon, label, note, onClick }) {
  return (
    <button onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-white active:bg-substrate">
      <span className="w-9 h-9 rounded-xl bg-farhat/10 text-farhat grid place-items-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" className="w-[19px] h-[19px]" aria-hidden="true">
          {icon}
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[0.95rem] font-semibold">{label}</span>
        {note && <span className="block text-xs text-body mt-0.5">{note}</span>}
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-body shrink-0" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

export default function More() {
  const navigate = useNavigate()
  const { account, signOut } = useAccount()
  const [leaving, setLeaving] = useState(false)

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-4 pb-6">

        <button onClick={() => navigate('/account')}
                className="mt-4 w-full flex items-center gap-3 p-4 rounded-2xl bg-farhat text-white text-left">
          <span className="relative w-12 h-12 rounded-full bg-white text-farhat grid place-items-center
                           text-lg font-extrabold ring-2 ring-gold shrink-0">
            {account ? (account.first_name || '?').charAt(0).toUpperCase() : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                <circle cx="12" cy="8" r="4.2" /><path d="M3.8 20.5a8.2 8.2 0 0 1 16.4 0z" />
              </svg>
            )}
            <span className="absolute -top-[3px] -left-[3px] w-[11px] h-[11px] rounded-full bg-gold border-2 border-farhat" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold truncate">
              {account ? account.first_name : 'Sign in or create your account'}
            </span>
            <span className="block text-xs text-white/85 mt-0.5">
              {account ? account.phone : 'Your orders, all in one place'}
            </span>
          </span>
        </button>

        <div className="mt-5 rounded-2xl border border-rule divide-y divide-rule overflow-hidden">
          <Row label="Find our branch" note="Westland, Accra · directions"
               onClick={() => window.open(BRANCH_MAP, '_blank')}
               icon={<><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>} />
          <Row label="Call us" note={BRANCH_PHONE.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
               onClick={() => { window.location.href = `tel:${BRANCH_PHONE}` }}
               icon={<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />} />
          <Row label="About Print Octos" note="Order printing from Farhat Printing Press"
               onClick={() => navigate('/more')}
               icon={<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>} />
        </div>

        {account && (
          <button
            onClick={async () => { setLeaving(true); await signOut(); setLeaving(false) }}
            disabled={leaving}
            className="mt-5 w-full px-4 py-3 rounded-xl border border-rule text-sm font-semibold
                       text-farhat disabled:opacity-40">
            {leaving ? 'Signing out…' : 'Sign out'}
          </button>
        )}

        <p className="mt-6 text-center text-[0.7rem] text-body">Print Octos · Farhat Printing Press</p>
      </main>
    </div>
  )
}
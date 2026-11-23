// src/partners/Shell.jsx
//
// The partner portal's frame. Desktop is centred like Octos's staff portals
// (one max-w-6xl column: sidebar and page). Tablets and phones lose the
// sidebar for a bottom tab bar, as the Print Octos app does.

import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/farhat-logo.png'

const NAV = [
  { to: '/partners', label: 'Dashboard', icon: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/partners/new', label: 'New job', icon: 'M12 5v14M5 12h14' },
]

function Icon({ d }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
         strokeLinejoin="round" className="w-5 h-5" aria-hidden="true"><path d={d} /></svg>
  )
}

export function TopBar({ partner, label = 'Trade partners', onSignOut }) {
  const initials = partner?.rep ? `${partner.rep.first_name[0] || ''}${partner.rep.last_name[0] || ''}` : ''
  return (
    <header className="bg-farhat">
      <div className="bg-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/partners" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-10 sm:h-11 w-auto" />
            <span className="leading-none">
              <span className="block text-[1.15rem] font-bold text-white tracking-tight">Farhat</span>
              <span className="block mt-0.5 text-[0.6rem] font-medium text-white/80 tracking-[0.13em] uppercase">{label}</span>
            </span>
          </Link>
          {partner?.rep && (
            <div className="ml-auto flex items-center gap-4 text-white/90 text-sm">
              {onSignOut && <button onClick={onSignOut} className="hover:text-white">Sign out</button>}
              <span className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-white text-farhat grid place-items-center text-[0.75rem] font-extrabold ring-2 ring-gold">{initials}</span>
                <span className="hidden md:inline">{partner.rep.first_name} {partner.rep.last_name}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default function Shell({ partner, onSignOut, children }) {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      <TopBar partner={partner} onSignOut={onSignOut} />
      <div className="flex justify-center">
        <div className="flex w-full max-w-6xl bg-[#faf8f5] min-h-[calc(100vh-68px)] lg:border-x lg:border-rule">
          <nav className="hidden lg:block w-[230px] shrink-0 border-r border-rule bg-white p-4">
            {NAV.map(n => (
              <Link key={n.to} to={n.to}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-[15px] ${pathname === n.to ? 'bg-farhat/10 text-farhat font-semibold' : 'text-ink hover:bg-substrate'}`}>
                <Icon d={n.icon} />{n.label}
              </Link>
            ))}
            {partner?.code && (
              <div className="mt-6 rounded-2xl bg-substrate p-4 text-sm">
                <p className="text-body">Partner ID</p>
                <p className="text-xl font-extrabold text-ink tracking-wider">{partner.code}</p>
              </div>
            )}
          </nav>
          <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 pb-28 lg:pb-7">{children}</main>
        </div>
      </div>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-md mx-auto grid grid-cols-2 py-2">
          {NAV.map(n => (
            <Link key={n.to} to={n.to}
                  className={`flex flex-col items-center gap-0.5 py-1 text-xs ${pathname === n.to ? 'text-farhat font-semibold' : 'text-body'}`}>
              <Icon d={n.icon} />{n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

// src/components/TabBar.jsx
//
// The app's tabs: Home, Categories, Orders, Cart, Account.
//
// Only in the app, and only on its main screens: a screen that is one
// task (a product, checkout, an order's details) hides it and shows a
// back arrow instead, so a sticky button never fights the tabs.
//
// A white tray with rounded top corners, lifted by a soft shadow rather
// than ruled off. The current tab is filled in Farhat red. It sits above
// the phone's home bar, never under it.

import { useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/CartContext.jsx'
import { useAccount } from '../lib/AccountContext.jsx'

export const TAB_ROOTS = ['/', '/categories', '/orders', '/account']

// Each icon twice: an outline, and a filled form for the current tab.
const TABS = [
  { to: '/', label: 'Home',
    line: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    fill: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor" /> },
  { to: '/categories', label: 'Categories',
    line: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>,
    fill: <g fill="currentColor"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></g> },
  { to: '/orders', label: 'Orders',
    line: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
    fill: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" fill="currentColor" /><path d="M9 8h6M9 12h6" stroke="#fff" /></> },
  { to: '/checkout', label: 'Cart',
    line: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h2.5l2.3 11.5a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" /></>,
    fill: null },
  { to: '/account', label: 'Account',
    line: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    fill: <g fill="currentColor"><circle cx="12" cy="8" r="4.2" /><path d="M3.8 21a8.2 8.2 0 0 1 16.4 0z" /></g> },
]

export default function TabBar() {
  const { inApp } = useAccount()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const cart = useCart()

  if (!inApp || !TAB_ROOTS.includes(pathname)) return null

  return (
    <>
      {/* Room for the tray, so the last thing on a page is never under it. */}
      <div aria-hidden="true" style={{ height: 'calc(76px + env(safe-area-inset-bottom, 0px))' }} />
      <nav
        aria-label="Main"
        className="fixed bottom-0 inset-x-0 z-30 bg-white rounded-t-3xl
                   shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 h-[72px]">
          {TABS.map(tab => {
            const on = pathname === tab.to
            return (
              <button
                key={tab.to}
                onClick={() => navigate(tab.to)}
                aria-current={on ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1
                            ${on ? 'text-farhat' : 'text-body'}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                     className="w-[26px] h-[26px]" aria-hidden="true">
                  {on && tab.fill ? tab.fill : tab.line}
                </svg>
                <span className={`text-[0.72rem] ${on ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
                {tab.to === '/checkout' && cart.count > 0 && (
                  <span className="absolute top-2.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1
                                   rounded-full bg-farhat text-white text-[0.62rem] font-extrabold
                                   leading-[18px] text-center tabular-nums ring-2 ring-white">
                    {cart.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
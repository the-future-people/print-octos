// src/components/TabBar.jsx
//
// The app's tabs: Home, Categories, Orders, Cart, More.
//
// Only in the app, and only on its main screens: a screen that is one
// task (a product, checkout, an order's details) hides it and shows a
// back arrow instead, so a sticky button never fights the tabs.
//
// It sits above the phone's home bar, never under it.

import { useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../lib/CartContext.jsx'
import { useAccount } from '../lib/AccountContext.jsx'

export const TAB_ROOTS = ['/', '/categories', '/orders', '/more']

const TABS = [
  { to: '/', label: 'Home',
    icon: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/categories', label: 'Categories',
    icon: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></> },
  { to: '/orders', label: 'Orders',
    icon: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></> },
  { to: '/checkout', label: 'Cart',
    icon: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h2.5l2.3 11.5a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" /></> },
  { to: '/more', label: 'More',
    icon: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></> },
]

export default function TabBar() {
  const { inApp } = useAccount()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const cart = useCart()

  if (!inApp || !TAB_ROOTS.includes(pathname)) return null

  return (
    <>
      {/* Room for the bar, so the last thing on a page is never under it. */}
      <div aria-hidden="true" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }} />
      <nav
        aria-label="Main"
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-rule"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 h-16">
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
                     strokeWidth={on ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round"
                     className="w-[22px] h-[22px]" aria-hidden="true">
                  {tab.icon}
                </svg>
                <span className={`text-[0.65rem] ${on ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
                {tab.to === '/checkout' && cart.count > 0 && (
                  <span className="absolute top-2 left-1/2 ml-1.5 min-w-[16px] h-4 px-1
                                   rounded-full bg-farhat text-white text-[0.6rem]
                                   font-extrabold leading-4 text-center tabular-nums">
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
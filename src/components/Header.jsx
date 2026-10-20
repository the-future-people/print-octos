import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { accountNotifications } from '../api/client'
import { useCart } from '../lib/CartContext.jsx'
import { useAccount } from '../lib/AccountContext.jsx'
import logo from '../assets/farhat-logo.png'

/**
 * The same header on every page.
 *
 * On the website: the red brand bar, with Track an order and the cart.
 *
 * In the app it is an app's: Home keeps the red brand bar with the
 * customer's account; every other screen gets a plain bar with its
 * title and a back arrow, because the tabs at the bottom now carry the
 * cart, the orders and the account.
 *
 * In the app it also clears the phone's status bar and camera notch:
 * the app is drawn edge to edge, and the bar makes room.
 */

// The app's names for its screens.
function titleFor(pathname) {
  if (pathname === '/categories') return 'Categories'
  if (pathname === '/orders') return 'My orders'
  if (pathname === '/checkout') return 'My cart'
  if (pathname === '/account') return 'My account'
  if (pathname === '/settings') return 'Settings'
  if (pathname === '/terms') return 'Terms & Privacy'
  if (pathname === '/notifications') return 'Notifications'
  if (pathname === '/paid') return 'Payment'
  if (pathname.startsWith('/track')) return 'Order details'
  return ''
}

const TAB_ROOTS = ['/', '/categories', '/orders', '/account']

export default function Header({ back = false, orderNumber = null, title = null, action = null, subtitle = null, curve = true, extra = null }) {
  const { inApp } = useAccount()
  const { pathname } = useLocation()

  if (inApp && pathname !== '/') {
    return (
      <AppBar
        title={title ?? titleFor(pathname)}
        back={!TAB_ROOTS.includes(pathname)}
        action={action}
        subtitle={subtitle}
        curve={curve}
        extra={extra}
      />
    )
  }
  return <BrandBar back={back} orderNumber={orderNumber} inApp={inApp} />
}

function AppBar({ title, back, action, subtitle, curve, extra }) {
  const navigate = useNavigate()
  return (
    <>
    <header
      className="sticky top-0 z-20 bg-farhat text-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-md mx-auto h-14 px-2 grid grid-cols-[48px_1fr_48px] items-center">
        {back ? (
          <button onClick={() => navigate(-1)} aria-label="Back"
                  className="w-11 h-11 grid place-items-center text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]"
                 aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : <span />}
        <h1 className="text-center text-[1.05rem] font-bold truncate">{title}</h1>
        {action || <span />}
      </div>
    </header>
    {/* The red runs on a little and the page curves up over it. The
        subtitle, where a screen has one, sits in that red. Account turns
        it off: its red carries on into the profile. */}
    {curve && (
      <div className="bg-farhat">
        {subtitle && (
          <p className="max-w-md mx-auto px-6 pb-3 -mt-1 text-center text-sm text-white/85">{subtitle}</p>
        )}
        {extra && <div className="max-w-md mx-auto px-4 pb-4">{extra}</div>}
        <div className="h-6 bg-white rounded-t-[28px] translate-y-px" />
      </div>
    )}
    </>
  )
}

function BrandBar({ back, orderNumber, inApp }) {
  const navigate = useNavigate()
  const cart = useCart()
  const { account } = useAccount()

  return (
    <header className="bg-farhat" style={inApp ? { paddingTop: 'env(safe-area-inset-top, 0px)' } : undefined}>
      <div className="bg-black/10">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">

          {back && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="shrink-0 -ml-1 text-white/90 hover:text-white transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="w-5 h-5">
                <path d="M19 12H5" />
                <path d="M11 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 min-w-0"
          >
            <img src={logo} alt="" className="h-11 sm:h-12 w-auto shrink-0"
                 aria-hidden="true" />
            {/* Stacked, so the mark reads as one block rather than a
                line of text running away from the bird. */}
            <span className="text-left leading-none">
              <span className="block text-[1.15rem] sm:text-[1.3rem] font-bold
                               text-white tracking-tight">
                Farhat
              </span>
              <span className="block mt-0.5 text-[0.6rem] sm:text-[0.68rem]
                               font-medium text-white/80 tracking-[0.13em]
                               uppercase">
                Printing Press
              </span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-4 sm:gap-5 shrink-0 -mr-0.5">
            {inApp && account && <Bell />}
            {inApp ? (
              <button
                onClick={() => navigate('/account')}
                aria-label={account ? `Your account, ${account.first_name}` : 'Sign in'}
                className="text-white/90 hover:text-white transition-colors"
              >
                {account ? (
                  // Their initial in a gold ring, with the logo's gold dot:
                  // the customer's own place in Print Octos.
                  <span className="relative w-8 h-8 rounded-full bg-white text-farhat
                                   grid place-items-center text-[0.8rem] font-extrabold
                                   ring-2 ring-gold">
                    {(account.first_name || '?').charAt(0).toUpperCase()}
                    <span className="absolute -top-[3px] -left-[3px] w-[9px] h-[9px]
                                     rounded-full bg-gold border-[1.5px] border-farhat" />
                  </span>
                ) : (
                  <span className="w-8 h-8 rounded-full border-[1.5px] border-white/70
                                   grid place-items-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[17px] h-[17px]"
                         aria-hidden="true">
                      <circle cx="12" cy="8" r="4.2" />
                      <path d="M3.8 20.5a8.2 8.2 0 0 1 16.4 0z" />
                    </svg>
                  </span>
                )}
              </button>
            ) : orderNumber ? (
              <span className="text-[0.7rem] sm:text-xs text-white/80
                               tracking-wide tabular-nums">
                {orderNumber}
              </span>
            ) : (
              <>
                <button
                  onClick={() => navigate('/track')}
                  aria-label="Track an order"
                  className="text-white/90 hover:text-white transition-colors"
                >
                  {/* Words on a wide screen, a parcel on a phone: both
                      are destinations rather than actions, so an icon
                      reads as well and leaves the cart room. */}
                  <span className="hidden sm:inline text-xs">Track an order</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                       className="w-[19px] h-[19px] sm:hidden" aria-hidden="true">
                    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                    <path d="M4 7.5l8 4.5 8-4.5" />
                    <path d="M12 12v9" />
                  </svg>
                </button>

                <button
                  onClick={() => navigate('/checkout')}
                  aria-label={
                    cart.count
                      ? `Your order, ${cart.count} item${cart.count === 1 ? '' : 's'}`
                      : 'Your order is empty'
                  }
                  className="relative text-white/90 hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                       className="w-[21px] h-[21px]" aria-hidden="true">
                    <circle cx="9" cy="20" r="1.4" />
                    <circle cx="18" cy="20" r="1.4" />
                    <path d="M2 3h2.5l2.3 11.5a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" />
                  </svg>

                  {/* No badge rather than a zero. A nought draws the eye
                      to nothing. */}
                  {cart.count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1
                                     rounded-full bg-white text-farhat text-[0.62rem]
                                     font-extrabold leading-4 text-center tabular-nums">
                      {cart.count}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

/**
 * The bell on Home, with how many messages are unread. Checked every
 * minute, and at once when a push arrives while the app is open.
 */
function Bell() {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => accountNotifications().then(r => r.data),
    refetchInterval: 60_000,
  })
  // Orders with news, not messages: two updates on one order is one.
  const unread = new Set((data?.items || []).filter(n => !n.read)
    .map(n => n.order_number || `note-${n.id}`)).size

  return (
    <button onClick={() => navigate('/notifications')}
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative text-white/90 hover:text-white transition-colors">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-gold
                         text-ink text-[0.6rem] font-extrabold leading-4 text-center tabular-nums">
          {unread}
        </span>
      )}
    </button>
  )
}
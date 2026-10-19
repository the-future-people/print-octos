import { useCallback, useEffect, useState } from 'react'
import { Navigate, Routes, Route, useNavigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Specify from './pages/Specify.jsx'
import Checkout from './pages/Checkout.jsx'
import Track from './pages/Track.jsx'
import Paid from './pages/Paid.jsx'
import ShortLink from './pages/ShortLink.jsx'
import Account from './pages/Account.jsx'
import Categories from './pages/Categories.jsx'
import Orders from './pages/Orders.jsx'
import Settings from './pages/Settings.jsx'
import Terms from './pages/Terms.jsx'
import Notifications from './pages/Notifications.jsx'
import PushBridge from './lib/PushBridge.jsx'
import LaunchSplash from './components/LaunchSplash.jsx'
import TabBar from './components/TabBar.jsx'
import { AccountProvider } from './lib/AccountContext.jsx'
import { takePaying } from './lib/paying'

export default function App() {
  // The opening animation, on top of the app while it loads. Only in the
  // phone app, only on a cold start; on the website it is gone at once.
  const [opening, setOpening] = useState(true)
  const opened = useCallback(() => setOpening(false), [])
  const navigate = useNavigate()

  // Back from Paystack. Either the website's return page hands over
  // through printoctos://paid, or the customer closes the panel
  // themselves; both land on the confirmation, which asks the server
  // what really happened.
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform?.()) return undefined
    const subs = []
    ;(async () => {
      const { App: Native } = await import('@capacitor/app')
      const { Browser } = await import('@capacitor/browser')
      subs.push(await Native.addListener('appUrlOpen', ({ url }) => {
        if (!url.startsWith('printoctos://paid')) return
        takePaying()
        const reference = new URL(url.replace('printoctos://', 'https://app/')).searchParams.get('reference') || ''
        Browser.close().catch(() => {})
        navigate(`/paid?reference=${encodeURIComponent(reference)}`)
      }))
      subs.push(await Browser.addListener('browserFinished', () => {
        const reference = takePaying()
        if (reference) navigate(`/paid?reference=${encodeURIComponent(reference)}&closed=1`)
      }))
    })()
    return () => subs.forEach(s => s.remove())
  }, [navigate])

  return (
    <AccountProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/orders" element={<Orders />} />
        {/* More became the Account tab; old links still arrive. */}
        <Route path="/more" element={<Navigate to="/account" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/account" element={<Account />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/service/:serviceId" element={<Specify />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/track" element={<Track />} />
        <Route path="/track/:orderNumber" element={<Track />} />
        {/* Where Paystack sends them afterwards, whether they paid or
            changed their mind, which is why the page asks before it
            celebrates. */}
        <Route path="/paid" element={<Paid />} />
        {/* The link in the text message, traded for the real token. */}
        <Route path="/t/:code" element={<ShortLink />} />
      </Routes>
      <TabBar />
      <PushBridge />
      {opening && <LaunchSplash onDone={opened} />}
    </AccountProvider>
  )
}
import { useCallback, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Specify from './pages/Specify.jsx'
import Checkout from './pages/Checkout.jsx'
import Track from './pages/Track.jsx'
import Paid from './pages/Paid.jsx'
import ShortLink from './pages/ShortLink.jsx'
import LaunchSplash from './components/LaunchSplash.jsx'

export default function App() {
  // The opening animation, on top of the app while it loads. Only in the
  // phone app, only on a cold start; on the website it is gone at once.
  const [opening, setOpening] = useState(true)
  const opened = useCallback(() => setOpening(false), [])

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
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
      {opening && <LaunchSplash onDone={opened} />}
    </>
  )
}
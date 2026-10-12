import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Specify from './pages/Specify.jsx'
import Checkout from './pages/Checkout.jsx'
import Track from './pages/Track.jsx'
import Paid from './pages/Paid.jsx'
import ShortLink from './pages/ShortLink.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/service/:serviceId" element={<Specify />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:orderNumber" element={<Track />} />
      {/* Where Paystack sends them afterwards — whether they paid or
          changed their mind, which is why the page asks before it
          celebrates. */}
      <Route path="/paid" element={<Paid />} />
      {/* The link in the text message, traded for the real token. */}
      <Route path="/t/:code" element={<ShortLink />} />
    </Routes>
  )
}
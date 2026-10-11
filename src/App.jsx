import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Specify from './pages/Specify.jsx'
import Checkout from './pages/Checkout.jsx'
import Track from './pages/Track.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/service/:serviceId" element={<Specify />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/track" element={<Track />} />
      <Route path="/track/:orderNumber" element={<Track />} />
    </Routes>
  )
}
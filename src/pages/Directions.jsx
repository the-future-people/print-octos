// src/pages/Directions.jsx
//
// Directions to the branch, inside the app.
//
// A live map (Leaflet, OpenStreetMap), the customer as a blue dot that
// moves as they do, the branch as the red pin, and the route between.
// The next turn sits in a banner at the top and moves on as each one is
// passed, the way Uber and Bolt show it: visual, no voice. The route
// comes from our own server, which asks OpenRouteService with a key the
// app never holds.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Geolocation } from '@capacitor/geolocation'
import { getRoute } from '../api/client'

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function metres(a, b) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const distanceText = m => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`)
const minutesText = s => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : `${Math.floor(s / 3600)} hr ${Math.round((s % 3600) / 60)} min`)

// OpenRouteService step types, as arrows.
const ARROW = { 0: '↰', 1: '↱', 2: '↰', 3: '↱', 4: '↖', 5: '↗', 6: '↑', 7: '⟳', 8: '⟳', 9: '↶', 10: '⚑', 11: '↑', 12: '↰', 13: '↱' }

function dot(color, size) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};
           border:3px solid #fff;box-shadow:0 0 0 6px ${color}33,0 2px 6px rgba(0,0,0,.3)"></span>`,
  })
}

export default function Directions() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const branch = state?.branch
  const target = useMemo(() => {
    const lat = Number(branch?.latitude), lng = Number(branch?.longitude)
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
  }, [branch])

  const holder = useRef(null)
  const map = useRef(null)
  const layers = useRef({})
  const [me, setMe] = useState(null)
  const [mode, setMode] = useState('driving')
  const [route, setRoute] = useState(null)
  const [problem, setProblem] = useState('')
  const [located, setLocated] = useState('asking')
  const [passed, setPassed] = useState(0)
  const [openList, setOpenList] = useState(false)

  const googleMaps = target
    ? `https://www.google.com/maps/dir/?api=1&destination=${target[0]},${target[1]}&travelmode=${mode}`
    : null

  // The map, once.
  useEffect(() => {
    if (!holder.current || !target || map.current) return undefined
    map.current = L.map(holder.current, { zoomControl: false, attributionControl: true }).setView(target, 15)
    L.tileLayer(TILES, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current)
    layers.current.branch = L.marker(target, { icon: dot('#E31E24', 22) }).addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [target])

  // Where they are, as they move.
  useEffect(() => {
    let watch = null
    let live = true
    ;(async () => {
      try {
        const perm = await Geolocation.requestPermissions().catch(() => null)
        if (perm && perm.location === 'denied') { setLocated('denied'); return }
        watch = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (pos, err) => {
          if (!live) return
          if (err || !pos) { setLocated(l => (l === 'asking' ? 'denied' : l)); return }
          setMe([pos.coords.latitude, pos.coords.longitude])
          setLocated('yes')
        })
      } catch {
        setLocated('denied')
      }
    })()
    return () => { live = false; if (watch) Geolocation.clearWatch({ id: watch }) }
  }, [])

  // The blue dot follows them.
  useEffect(() => {
    if (!map.current || !me) return
    if (!layers.current.me) layers.current.me = L.marker(me, { icon: dot('#1d4ed8', 18) }).addTo(map.current)
    else layers.current.me.setLatLng(me)
  }, [me])

  // The route: when we first know where they are, when the mode changes,
  // and again if they wander well off it.
  const fetchedFrom = useRef(null)
  useEffect(() => {
    if (!me || !target) return
    const offRoute = route?.path?.length && Math.min(...route.path.map(p => metres(me, p))) > 120
    if (fetchedFrom.current && fetchedFrom.current.mode === mode && !offRoute) return
    fetchedFrom.current = { mode }
    setProblem('')
    getRoute(me, target, mode)
      .then(({ data }) => {
        setRoute(data)
        setPassed(0)
        if (!map.current) return
        layers.current.line?.remove()
        layers.current.line = L.polyline(data.path, { color: '#1d4ed8', weight: 6, opacity: 0.9 }).addTo(map.current)
        map.current.fitBounds(layers.current.line.getBounds(), { padding: [40, 40], paddingBottomRight: [40, 260] })
      })
      .catch(err => setProblem(err.response?.data?.detail || 'We couldn’t get directions just now.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, mode, target])

  // Moving on: a turn counts as passed once they are within 25 m of it.
  useEffect(() => {
    if (!me || !route?.steps?.length) return
    const next = route.steps[passed + 1]
    if (next && metres(me, next.at) < 25) setPassed(p => p + 1)
  }, [me, route, passed])

  const steps = route?.steps || []
  const upcoming = steps[passed + 1] || steps[passed]
  const toNext = me && upcoming ? metres(me, upcoming.at) : null
  const arrive = route ? new Date(Date.now() + route.duration_s * 1000)
    .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : null

  async function openGoogle() {
    if (!googleMaps) return
    if (window.Capacitor?.isNativePlatform?.()) {
      const { Browser } = await import('@capacitor/browser')
      Browser.open({ url: googleMaps })
    } else window.open(googleMaps, '_blank')
  }

  if (!branch) {
    return (
      <div className="min-h-screen grid place-items-center px-8 text-center">
        <div>
          <p className="text-sm text-body">Open directions from an order’s details.</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 rounded-lg bg-farhat text-white text-sm font-bold">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#eef0ea]">
      <div ref={holder} className="absolute inset-0 z-0" />

      <div className="absolute inset-x-0 top-0 z-10 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
        {upcoming && toNext != null ? (
          <div className="flex items-center gap-3 rounded-2xl bg-[#0f5132] text-white px-3.5 py-3 shadow-lg">
            <span className="w-11 h-11 rounded-xl bg-white/15 grid place-items-center text-2xl shrink-0">
              {ARROW[upcoming.type] || '↑'}
            </span>
            <div className="min-w-0">
              <p className="text-xl font-extrabold leading-none">{distanceText(toNext)}</p>
              <p className="mt-1 text-sm text-white/90 truncate">{upcoming.instruction}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white px-3.5 py-3 shadow-lg text-sm">
            {located === 'denied'
              ? 'Allow location to see the route from where you are.'
              : problem || 'Finding where you are…'}
          </div>
        )}
        <button onClick={() => navigate(-1)} aria-label="Back"
                className="mt-2.5 w-10 h-10 rounded-full bg-white shadow-md grid place-items-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
               strokeLinejoin="round" className="w-5 h-5" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-white rounded-t-3xl shadow-[0_-6px_22px_rgba(0,0,0,0.12)]
                      px-4 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
        <button onClick={() => setOpenList(o => !o)} aria-label="Show the turns"
                className="block mx-auto w-10 h-1.5 rounded-full bg-[#ddd] mb-3" />
        <div className="flex items-baseline justify-between">
          <p>
            <span className="text-2xl font-black">{route ? minutesText(route.duration_s) : '—'}</span>
            {route && <span className="text-sm text-body"> · {distanceText(route.distance_m)}</span>}
          </p>
          {arrive && <span className="text-xs text-body">Arrive {arrive}</span>}
        </div>
        <p className="text-sm text-body">
          to <strong className="text-ink">{branch.name}</strong>
          {branch.closing_time ? `, open until ${branch.closing_time}` : ''}
        </p>

        <div className="mt-3 flex p-1 rounded-full bg-[#f3f1ec]">
          {[['driving', 'By car'], ['walking', 'On foot']].map(([key, label]) => (
            <button key={key} onClick={() => setMode(key)}
                    className={`flex-1 py-2 rounded-full text-sm font-semibold
                                ${mode === key ? 'bg-white text-ink shadow-sm' : 'text-body'}`}>
              {label}
            </button>
          ))}
        </div>

        {openList && steps.length > 0 && (
          <ol className="mt-3 max-h-[30vh] overflow-y-auto divide-y divide-[#f0ede8]">
            {steps.slice(passed + 1).map((s, i) => (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-7 h-7 rounded-lg bg-[#f3f1ec] grid place-items-center shrink-0">{ARROW[s.type] || '↑'}</span>
                <span className="flex-1 min-w-0">{s.instruction}</span>
                <span className="text-xs text-body shrink-0">{distanceText(s.distance_m)}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`tel:${branch.phone || '0556244194'}`}
             className="py-3 rounded-xl border border-[#e3e0da] text-center text-sm font-bold">Call the branch</a>
          <button onClick={openGoogle}
                  className="py-3 rounded-xl border border-[#e3e0da] text-sm font-bold">Open in Google Maps</button>
        </div>
      </div>
    </div>
  )
}

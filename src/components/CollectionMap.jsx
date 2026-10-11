import { useEffect, useState } from 'react'

/**
 * Where to collect, on a map.
 *
 * Not a delivery tracker. Nothing is moving toward the customer — the
 * branch stays where it is and they come to it — so the question this
 * answers is "where do I go and how far is that", not "where is my
 * thing right now".
 *
 * A still image rather than a pannable map, and the Directions button
 * hands the customer to the app on their phone that does this properly.
 * Ours would be a worse version of something they already have.
 *
 * Location is asked for only here, and only when they tap. The page is
 * complete without it: the pin, the address and the way to get there
 * are the useful part, and the distance is a bonus.
 */

// OpenStreetMap's own tile server. No key, no billing, and the terms
// are fine at the volume one print shop generates.
const TILE = 'https://tile.openstreetmap.org'

export default function CollectionMap({ branch }) {
  const [me, setMe] = useState(null)
  const [asking, setAsking] = useState(false)
  const [refused, setRefused] = useState(false)

  const lat = Number(branch?.latitude)
  const lon = Number(branch?.longitude)
  const located = Number.isFinite(lat) && Number.isFinite(lon)

  // A branch we have no coordinates for still has an address and a
  // phone number, which is most of what anyone needs.
  if (!branch) return null

  function findMe() {
    if (!navigator.geolocation) {
      setRefused(true)
      return
    }
    setAsking(true)
    navigator.geolocation.getCurrentPosition(
      position => {
        setMe({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setAsking(false)
      },
      () => {
        // Refused, or the phone could not work it out. Either way the
        // page carries on — this was never the important part.
        setRefused(true)
        setAsking(false)
      },
      { timeout: 8000, maximumAge: 300_000 },
    )
  }

  const distance = me && located ? kilometres(me, { lat, lon }) : null

  return (
    <div className="rounded-xl border border-rule overflow-hidden">

      {located && (
        <div className="relative h-[150px] bg-substrate">
          <img
            src={staticMap(lat, lon)}
            alt={`Map showing ${branch.name}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />

          {/* The branch, pinned. Sits above the tile rather than being
              drawn into it, so one image serves every branch. */}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full
                           w-[30px] h-[30px] rounded-full bg-farhat border-[2.5px]
                           border-white shadow-md grid place-items-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                 className="w-[15px] h-[15px] text-white" aria-hidden="true">
              <path d="M3 9l1.5-5h15L21 9" />
              <path d="M4 9h16v11H4z" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </span>

          {distance != null && (
            <div className="absolute left-2.5 bottom-2.5 rounded-lg bg-white/95
                            px-2.5 py-1.5">
              <p className="text-[0.6rem] text-body leading-none">From you</p>
              <p className="mt-0.5 text-sm font-extrabold tabular-nums leading-none">
                {distance} km
              </p>
            </div>
          )}
        </div>
      )}

      <div className="px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">{branch.name}</p>
          {branch.is_open != null && (
            <span className={`shrink-0 text-xs font-semibold ${
              branch.is_open ? 'text-emerald-700' : 'text-body'
            }`}>
              {branch.is_open
                ? `Open until ${branch.closing_time || 'later'}`
                : 'Closed now'}
            </span>
          )}
        </div>

        {branch.address && (
          <p className="mt-1 text-xs text-body">{branch.address}</p>
        )}

        <div className="mt-3 flex gap-2">
          <a
            href={directionsTo(branch, lat, lon, located)}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5
                       px-4 py-2.5 rounded-lg bg-farhat text-white text-sm
                       font-semibold hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                 className="w-4 h-4" aria-hidden="true">
              <path d="M3 11l18-8-8 18-2-8-8-2z" />
            </svg>
            Directions
          </a>

          {branch.phone && (
            <a
              href={`tel:${branch.phone}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5
                         px-4 py-2.5 rounded-lg border border-rule text-sm
                         font-semibold hover:border-ink transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                   className="w-4 h-4" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
              </svg>
              Call
            </a>
          )}
        </div>

        {located && !me && !refused && (
          <button
            onClick={findMe}
            disabled={asking}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5
                       text-xs text-body hover:text-ink transition-colors
                       disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                 className="w-3.5 h-3.5" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            {asking ? 'Finding you…' : 'Share your location to see how far'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A still map centred on the branch.
 *
 * Built from four OpenStreetMap tiles so the pin has room around it.
 * A pannable map would be nicer and is not worth a dependency: the
 * customer who wants to explore taps Directions and gets the app that
 * does it properly.
 */
function staticMap(lat, lon, zoom = 15) {
  const n = 2 ** zoom
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(
    ((1 - Math.log(
      Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
    ) / Math.PI) / 2) * n,
  )
  return `${TILE}/${zoom}/${x}/${y}.png`
}

/**
 * Hand the customer to their own maps app.
 *
 * Coordinates where we have them, the address where we do not — a
 * branch nobody has pinned yet still has a street a search can find.
 */
function directionsTo(branch, lat, lon, located) {
  if (located) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
  }
  const query = encodeURIComponent(`${branch.name} ${branch.address || 'Accra'}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

/**
 * Straight line, not by road.
 *
 * A road distance needs a routing service and a key. This is honest
 * about what it is: how far away the branch is, not how far you will
 * drive.
 */
function kilometres(from, to) {
  const R = 6371
  const dLat = ((to.lat - from.latitude) * Math.PI) / 180
  const dLon = ((to.lon - from.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return km < 10 ? km.toFixed(1) : Math.round(km)
}
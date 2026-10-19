// src/pages/Categories.jsx
//
// The whole catalogue, everything visible at once.
//
// A search in the red header, a featured carousel of real products with
// their real prices, then every section as a grid of cards. Sections
// come from the catalogue itself, so a new kind of product (branding,
// apparel) gets its section the day it goes online, and nothing is
// shown that cannot be ordered.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCatalogue } from '../api/client'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'
import ProductBadge from '../components/ProductBadge.jsx'

const bySize = unit => unit === 'PER_SQFT' || unit === 'PER_SQCM'

function priceLine(s) {
  const price = s.price ? Number(s.price).toFixed(2) : null
  const quantityUnit = (s.spec_template || []).find(f => f.key === 'quantity')?.unit
  if (!price) return null
  if (bySize(s.unit)) return `GHS ${price} per sq ft`
  if (quantityUnit === 'boxes') return `GHS ${price} a box`
  if (['sheet', 'PER_PAGE', 'PER_SHEET'].includes(s.unit)) return `From GHS ${price} a sheet`
  return `From GHS ${price}`
}

// What each catalogue category is called here. Anything new gets its
// own name, tidied, until it is given a better one.
const SECTION = { PRODUCTION: 'Order ahead', INSTANT: 'Documents & flyers' }
const sectionName = c => SECTION[c] || (c || 'More').toLowerCase().replace(/(^|_)(\w)/g, (_, s, ch) => (s ? ' ' : '') + ch.toUpperCase())

const ordered = list => [
  ...list.filter(s => s.available !== false),
  ...list.filter(s => s.available === false),
]

function matches(services, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return ordered(services.filter(s => {
    const text = `${s.name} ${s.base_name || ''} ${s.description || ''}`.toLowerCase()
    return words.every(w => text.includes(w))
  }))
}

function Card({ s, onOpen }) {
  const soon = s.available === false
  const photo = serviceImage(s.base_name || s.name)
  return (
    <button onClick={() => !soon && onOpen(s.id)} disabled={soon}
            className="relative flex flex-col text-left rounded-2xl bg-white border border-[#ece9e3]
                       overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)] active:bg-substrate
                       disabled:cursor-default">
      {soon && (
        <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-full bg-ink/80 text-white
                         text-[0.55rem] font-bold">Coming soon</span>
      )}
      {photo ? (
        <img src={photo} alt="" loading="lazy"
             className={`w-full aspect-[4/3] object-cover ${soon ? 'grayscale opacity-60' : ''}`} />
      ) : (
        <div className="w-full aspect-[4/3] bg-[#fdecec] grid place-items-center">
          <span className="scale-[1.9]"><ProductBadge name={s.base_name || s.name} onLight /></span>
        </div>
      )}
      <div className={`flex-1 flex flex-col px-2.5 pt-2 pb-2.5 ${soon ? 'opacity-60' : ''}`}>
        <p className="text-[0.78rem] font-bold leading-tight line-clamp-2">{s.name}</p>
        <div className="mt-auto pt-1 flex items-end justify-between gap-1">
          <p className="text-[0.66rem] font-semibold leading-tight text-farhat">
            {soon ? 'Not yet' : priceLine(s) || ''}
          </p>
          {!soon && (
            <span className="shrink-0 w-5 h-5 rounded-full border border-[#e5e2dc] grid place-items-center text-ink"
                  aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                   strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/**
 * Real products, sliding every few seconds. The customer can swipe; the
 * dots follow, and a swipe pauses the slide for a while.
 */
function Featured({ items, onOpen }) {
  const track = useRef(null)
  const [at, setAt] = useState(0)
  const touched = useRef(0)

  useEffect(() => {
    if (items.length < 2) return undefined
    const tick = setInterval(() => {
      if (Date.now() - touched.current < 8000 || !track.current) return
      const next = (at + 1) % items.length
      track.current.scrollTo({ left: next * track.current.clientWidth, behavior: 'smooth' })
    }, 5000)
    return () => clearInterval(tick)
  }, [at, items.length])

  if (!items.length) return null
  return (
    <div className="mt-1">
      <div ref={track}
           onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
           onTouchStart={() => { touched.current = Date.now() }}
           className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl
                      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(s => {
          const photo = serviceImage(s.base_name || s.name)
          return (
            <div key={s.id} className="snap-start shrink-0 w-full flex rounded-2xl overflow-hidden bg-[#fdf0f0]">
              <div className="flex-1 min-w-0 p-4 flex flex-col">
                <p className="text-[0.7rem] font-bold uppercase tracking-wider text-body">Featured</p>
                <p className="mt-0.5 text-lg font-extrabold leading-tight text-farhat">{s.name}</p>
                <p className="mt-1 text-[0.72rem] leading-snug text-body line-clamp-2">{s.description}</p>
                <button onClick={() => onOpen(s.id)}
                        className="mt-auto self-start inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl
                                   bg-farhat text-white text-xs font-bold">
                  Order now
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                       strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
              {photo && <img src={photo} alt="" className="w-[45%] object-cover" />}
            </div>
          )
        })}
      </div>
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {items.map((s, i) => (
            <span key={s.id} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-4 bg-farhat' : 'w-1.5 bg-[#e5e2dc]'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Categories() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0

  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const open = id => navigate(`/service/${id}`)
  // Featured: what can be ordered and has a photo worth showing.
  const featured = services.filter(s => s.available !== false && serviceImage(s.base_name || s.name)).slice(0, 4)
  const sections = Object.entries(services.reduce((acc, s) => {
    const key = s.category || 'OTHER'
    ;(acc[key] = acc[key] || []).push(s)
    return acc
  }, {}))
    // Order ahead first, then the rest as the catalogue lists them.
    .sort(([a], [b]) => (a === 'PRODUCTION' ? -1 : b === 'PRODUCTION' ? 1 : 0))
    .map(([key, list]) => [sectionName(key), ordered(list)])

  const search = (
    <label className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" className="w-4 h-4 text-body shrink-0" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
      </svg>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search for a product or service…"
             className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-body/70
                        focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {searching && (
        <button onClick={() => setQuery('')} aria-label="Clear" className="text-body text-lg leading-none">×</button>
      )}
    </label>
  )

  const found = searching ? matches(services, query) : []

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header subtitle="Explore our printing services" extra={search} />
      <main className="max-w-md mx-auto px-4 pb-6">
        {isLoading && <p className="py-8 text-sm text-body">Loading…</p>}
        {isError && <p className="py-8 text-sm text-farhat">The catalogue didn’t load. Try again in a moment.</p>}

        {searching ? (
          <section className="mt-1">
            <p className="mx-1 text-xs font-bold uppercase tracking-wider text-body">
              {found.length} result{found.length === 1 ? '' : 's'}
            </p>
            {found.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-2.5">
                {found.map(s => <Card key={s.id} s={s} onOpen={open} />)}
              </div>
            ) : (
              <p className="mt-6 text-center text-sm text-body">
                Nothing called “{query.trim()}” yet.{' '}
                <a href="tel:0556244194" className="font-semibold text-farhat">Call us</a> and we’ll help.
              </p>
            )}
          </section>
        ) : (
          <>
            <Featured items={featured} onOpen={open} />
            {sections.map(([title, list]) => (
              <section key={title} className="mt-6">
                <h2 className="mx-1 text-base font-bold">{title}</h2>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {list.map(s => <Card key={s.id} s={s} onOpen={open} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
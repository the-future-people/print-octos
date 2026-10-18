// src/pages/Categories.jsx
//
// Everything Print Octos sells, as a list: photo, name, what it costs.
// The prices are the catalogue's own, so they are what the customer
// will be quoted. What cannot be ordered yet stays visible as Coming
// soon, as on the home page, but does not open.

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCatalogue } from '../api/client'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'

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

const ordered = list => [
  ...list.filter(s => s.available !== false),
  ...list.filter(s => s.available === false),
]

export default function Categories() {
  const navigate = useNavigate()
  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const groups = [
    ['Order ahead', ordered(services.filter(s => s.category === 'PRODUCTION'))],
    ['Documents & flyers', ordered(services.filter(s => s.category !== 'PRODUCTION'))],
  ].filter(([, list]) => list.length)

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-4 pb-6">
        {isLoading && <p className="py-10 text-sm text-body">Loading…</p>}
        {isError && <p className="py-10 text-sm text-farhat">The catalogue didn’t load. Try again in a moment.</p>}

        {groups.map(([title, list]) => (
          <section key={title} className="mt-5">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-body">{title}</h2>
            <div className="mt-2 rounded-2xl border border-rule divide-y divide-rule overflow-hidden">
              {list.map(s => {
                const soon = s.available === false
                const photo = serviceImage(s.base_name || s.name)
                const price = priceLine(s)
                return (
                  <button
                    key={s.id}
                    onClick={() => !soon && navigate(`/service/${s.id}`)}
                    disabled={soon}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left bg-white
                               active:bg-substrate disabled:cursor-default"
                  >
                    {photo ? (
                      <img src={photo} alt="" loading="lazy"
                           className={`w-14 h-14 rounded-xl object-cover shrink-0
                                       ${soon ? 'grayscale opacity-60' : ''}`} />
                    ) : (
                      <span className="w-14 h-14 rounded-xl bg-substrate shrink-0" />
                    )}
                    <span className={`flex-1 min-w-0 ${soon ? 'opacity-60' : ''}`}>
                      <span className="block text-[0.95rem] font-semibold truncate">{s.name}</span>
                      <span className={`block mt-0.5 text-xs ${soon ? 'text-body' : 'text-farhat font-semibold'}`}>
                        {soon ? 'Coming soon' : price || ' '}
                      </span>
                    </span>
                    {!soon && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round"
                           className="w-5 h-5 shrink-0 text-body" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { accountOrders, getCatalogue } from '../api/client'
import { ServiceIcon } from '../lib/icons.jsx'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'
import ProductBadge from '../components/ProductBadge.jsx'
import { useAccount } from '../lib/AccountContext.jsx'

/**
 * What a customer sees on opening.
 *
 * Processed work first — banners, cards, stickers — because that is
 * what online is for: jobs worth planning ahead, where the price and
 * the turnaround are worth knowing before leaving the house. Documents
 * and flyers follow, for the customer who wants to send a file and
 * collect it printed, laminated or bound.
 *
 * The catalogue only holds what can be ordered online. Something not
 * ready yet (a machine still to arrive, a price still to set) shows as
 * Coming soon: visible, so customers know it is on its way, but not
 * something they can open.
 *
 * The tiles are built around a photograph. Printing is bought by eye:
 * nobody orders a banner from a description.
 *
 * In the app, the website's headline gives way to a greeting: someone
 * who installed Print Octos already knows what it is for, and the top
 * of the screen is better spent on their order and the products.
 *
 * The search filters the catalogue as they type, by name and by
 * description, on the website and in the app alike.
 */

function pricingBasis(service) {
  const unit = service.unit
  const quantityUnit = (service.spec_template || []).find(f => f.key === 'quantity')?.unit
  if (unit === 'PER_SQFT' || unit === 'PER_SQCM') return 'Priced by size'
  if (unit === 'PER_JOB') return 'Priced per job'
  if (quantityUnit === 'boxes') return 'Priced per box'
  if (unit === 'sheet' || unit === 'PER_PAGE' || unit === 'PER_SHEET') return 'Priced per sheet'
  if (unit === 'PER_COPY') return 'Priced per copy'
  return 'Priced per piece'
}

const bySize = unit => unit === 'PER_SQFT' || unit === 'PER_SQCM'

// Ready ones first, then what is coming.
const ordered = list => [
  ...list.filter(s => s.available !== false),
  ...list.filter(s => s.available === false),
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Landing() {
  const navigate = useNavigate()
  const { inApp, account } = useAccount()
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0

  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const processed = ordered(services.filter(s => s.category === 'PRODUCTION'))
  const documents = ordered(services.filter(s => s.category !== 'PRODUCTION'))
  const ready = services.filter(s => s.available !== false)

  return (
    <div className="min-h-screen bg-white text-ink">

      <Header />

      {/* The hero carries on in the same red, so the bar above reads as
          part of it rather than a separate strip. */}
      <section className="bg-farhat">
           <div className={`max-w-4xl mx-auto px-5 ${inApp ? 'pt-4 pb-6' : 'pt-7 pb-8'}`}>
          {inApp ? (
            <>
              <p className="text-xl font-bold text-white leading-tight">
                {account ? `${greeting()}, ${account.first_name}` : greeting()}
              </p>
              <p className="mt-0.5 text-sm text-white/85">What are we printing today?</p>
            </>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-white leading-tight
                            text-balance">
                Order your printing <span className="text-gold">before you get here.</span>
              </p>
              <p className="mt-2 text-sm text-white/85 max-w-[46ch]">
                Pick what you need, see the price and the day it’s ready, and pay
                now. Collect at Westland.
              </p>
            </>
          )}

          {/* The button is a second way to do the same thing as typing:
              results appear as they type. Worth the space here: a
              customer who does not know the word for what they want
              needs the search to look like the way forward. */}
             <div className={`${inApp ? 'mt-4' : 'mt-5'} flex items-center gap-2 p-1.5 pl-4
                          rounded-full bg-white focus-within:ring-2 focus-within:ring-white/60`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" className="w-4 h-4 shrink-0 text-body"
                 aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              placeholder={inApp ? 'Search banners, cards, prints…' : 'What are you printing?'}
              aria-label="Search what we print"
              className="flex-1 min-w-0 bg-transparent text-[0.95rem]
                         placeholder:text-body/70 focus:outline-none
                         [&::-webkit-search-cancel-button]:hidden"
            />
            {searching ? (
              <button onClick={() => setQuery('')} aria-label="Clear search"
                      className="shrink-0 w-9 h-9 grid place-items-center rounded-full
                                 text-body text-lg leading-none">
                ×
              </button>
            ) : (
              <button
                onClick={e => e.currentTarget.parentElement.querySelector('input')?.focus()}
                className="shrink-0 px-5 sm:px-6 py-2.5 rounded-full bg-farhat
                           text-white text-sm font-semibold hover:opacity-90
                           transition-opacity focus:outline-none
                           focus-visible:ring-2 focus-visible:ring-white">
                Search
              </button>
            )}
          </div>

          {/* The chips are the catalogue's own names, so tapping one is
              the same thing as finding it in the grid below. Only what
              can be ordered now: a chip that leads nowhere is a let-down. */}
          {!searching && ready.length > 0 && (
               <div className="mt-4 flex gap-2 overflow-x-auto pb-1
                            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ready.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/service/${s.id}`)}
                  className="shrink-0 inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5
                             rounded-full bg-white/15 text-white text-xs
                             hover:bg-white/25 transition-colors
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ProductBadge name={s.base_name || s.name} />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-5 pb-12">

        {isLoading && (
          <p className="py-10 text-sm text-body">Loading the catalogue…</p>
        )}

        {isError && (
          <p className="py-10 text-sm text-farhat">
            The catalogue didn’t load. Refresh the page to try again.
          </p>
        )}

        {searching ? (
          <SearchResults services={services} query={query} navigate={navigate} />
        ) : (
          <>
            {inApp && <AppHome services={services} navigate={navigate} />}

            {!inApp && processed.length > 0 && (
              <Section
                title="Order ahead"
                note="Banners, stickers and cards: pick one to get started."
                services={processed}
                onOpen={id => navigate(`/service/${id}`)}
              />
            )}

            {!inApp && documents.length > 0 && (
              <Section
                title="Documents & flyers"
                note="Send your file and collect it printed, with lamination, binding or an envelope if you like."
                services={documents}
                onOpen={id => navigate(`/service/${id}`)}
              />
            )}

            {!isLoading && !isError && services.length === 0 && (
              <p className="py-10 text-sm text-body">
                Nothing to order ahead yet. Walk in and we’ll sort you out.
              </p>
            )}

            {!inApp && (
              <>
                <section className="mt-8 rounded-xl bg-farhat/5 border border-farhat/20
                                    px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.95rem] font-semibold">Not sure what it’s called?</p>
                    <p className="mt-1 text-sm leading-relaxed text-body">
                      Send a photo of what you have. We’ll tell you what it takes and
                      what it costs.
                    </p>
                  </div>
                  <button className="shrink-0 px-5 py-2.5 rounded-lg bg-farhat text-white
                                     text-sm font-semibold hover:opacity-90 transition-opacity
                                     focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                    Send a photo
                  </button>
                </section>

                <footer className="mt-8 pt-5 border-t border-rule">
                  <p className="flex items-center justify-center gap-2 text-sm text-body">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
                         strokeLinecap="round" strokeLinejoin="round"
                         className="w-4 h-4 shrink-0" aria-hidden="true">
                      <path d="M3 9l1.5-5h15L21 9" />
                      <path d="M4 9h16v11H4z" />
                      <path d="M9 20v-6h6v6" />
                    </svg>
                    Just need a photocopy? Walk in, or search above.
                  </p>
                </footer>
              </>
            )}
          </>
        )}

      </main>
    </div>
  )
}

function Section({ title, note, services, onOpen }) {
  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-0.5 text-sm text-body">{note}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {services.map(service => (
          <Tile key={service.id} service={service} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}

function Tile({ service, onOpen }) {
  const soon = service.available === false
  // The photo is found by the service's own name, which stays put when
  // the name customers see is tidied.
  const photo = serviceImage(service.base_name || service.name)

  return (
    <button
      onClick={() => !soon && onOpen(service.id)}
      disabled={soon}
      aria-disabled={soon}
      className={`group relative flex flex-col text-left bg-white rounded-xl border
                  border-rule overflow-hidden focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-ink transition-all
                  ${soon
                    ? 'cursor-default'
                    : 'hover:border-farhat hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]'}`}
    >
      {soon && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-ink/85
                         text-white text-[0.65rem] font-semibold tracking-wide">
          Coming soon
        </span>
      )}

      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className={`aspect-[4/3] w-full object-cover ${soon ? 'grayscale opacity-60' : ''}`}
        />
      ) : (
        <div className="aspect-[4/3] w-full bg-substrate" />
      )}

      <div className={`flex-1 flex flex-col px-3 py-3 ${soon ? 'opacity-60' : ''}`}>
        <p className="text-[0.95rem] font-semibold leading-tight">
          {service.name}
        </p>
        <p className="mt-1 text-xs leading-snug text-body line-clamp-3">
          {service.description}
        </p>

        {/* The footer sits on the bottom edge of every card, whatever
            the description's length, so the rules line up across the
            row instead of stepping. */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2
                        border-t border-rule">
          <span className={`inline-flex items-center gap-1.5 text-[0.7rem] ${
            bySize(service.unit) ? 'text-farhat font-semibold' : 'text-body'
          }`}>
            <ServiceIcon name={service.name} className="w-3.5 h-3.5 shrink-0" />
            {soon ? 'Not orderable yet' : pricingBasis(service)}
          </span>
          {!soon && (
            <span className="shrink-0 w-6 h-6 rounded-full bg-farhat text-white
                             text-xs leading-none flex items-center justify-center
                             group-hover:scale-110 transition-transform"
                  aria-hidden="true">
              ›
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Search ───────────────────────────────────────────────────────

// Westland's own line and map, as on the More tab.
const BRANCH_PHONE = '0556244194'
const BRANCH_MAP = 'https://www.google.com/maps/search/?api=1&query=Farhat+Printing+Press+Westland+Accra'

/**
 * Every word they typed has to appear somewhere in the product's name
 * or description, so "a4 colour" finds A4 Colour Printing and "ban"
 * finds banners. What can be ordered comes first.
 */
function matches(services, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return ordered(services.filter(s => {
    const text = `${s.name} ${s.base_name || ''} ${s.description || ''}`.toLowerCase()
    return words.every(w => text.includes(w))
  }))
}

function SearchResults({ services, query, navigate }) {
  const found = matches(services, query)
  return (
    <section className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-body">
        {found.length} result{found.length === 1 ? '' : 's'}
      </p>
      <div className="mt-2 rounded-2xl border border-rule divide-y divide-rule overflow-hidden">
        {found.map(s => {
          const soon = s.available === false
          const photo = serviceImage(s.base_name || s.name)
          return (
            <button key={s.id} onClick={() => !soon && navigate(`/service/${s.id}`)} disabled={soon}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left bg-white
                               active:bg-substrate disabled:cursor-default">
              {photo ? (
                <img src={photo} alt="" className={`w-12 h-12 rounded-xl object-cover shrink-0 ${soon ? 'grayscale opacity-60' : ''}`} />
              ) : (
                <span className="w-12 h-12 rounded-xl bg-substrate grid place-items-center shrink-0">
                  <ServiceIcon name={s.name} className="w-5 h-5 text-body/60" />
                </span>
              )}
              <span className={`flex-1 min-w-0 ${soon ? 'opacity-60' : ''}`}>
                <span className="block text-sm font-semibold truncate">{s.name}</span>
                <span className={`block mt-0.5 text-xs ${soon ? 'text-body' : 'text-farhat font-semibold'}`}>
                  {soon ? 'Coming soon' : priceLine(s) || pricingBasis(s)}
                </span>
              </span>
              {!soon && <span className="text-body text-lg" aria-hidden="true">›</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-center text-sm text-body">
        {found.length === 0 ? `Nothing called “${query.trim()}” yet. ` : 'Can’t find it? '}
        <a href={`tel:${BRANCH_PHONE}`} className="font-semibold text-farhat">Call us</a>
        {' '}and we’ll help.
      </p>
    </section>
  )
}

// ── The app's home, below the hero ───────────────────────────────

function priceLine(s) {
  const price = s.price ? Number(s.price).toFixed(2) : null
  const quantityUnit = (s.spec_template || []).find(f => f.key === 'quantity')?.unit
  if (!price) return null
  if (bySize(s.unit)) return `GHS ${price} per sq ft`
  if (quantityUnit === 'boxes') return `GHS ${price} a box`
  if (['sheet', 'PER_PAGE', 'PER_SHEET'].includes(s.unit)) return `From GHS ${price} a sheet`
  return `From GHS ${price}`
}

/**
 * Home in the app: one card that means something right now, then the
 * products as shelves. Nothing here repeats a tab.
 */
function AppHome({ services, navigate }) {
  const ready = services.filter(s => s.available !== false)
  const ahead = ready.filter(s => s.category === 'PRODUCTION')
  const documents = ready.filter(s => s.category !== 'PRODUCTION')

  return (
    <>
      <NowCard navigate={navigate} />
      {ahead.length > 0 && <Shelf title="Order ahead" services={ahead} navigate={navigate} />}
      {documents.length > 0 && <Shelf title="Documents & flyers" services={documents} navigate={navigate} />}
    </>
  )
}

// How far along each stage is, for the bar on the card.
const PROGRESS = { paid: 10, inspecting: 25, press: 55, finishing: 80 }
const STAGE_LABEL = {
  paid: 'Paid', inspecting: 'Being checked', press: 'In press', finishing: 'Finishing',
}

function timeLeft(e) {
  if (!e) return null
  if (e.held_up) return 'A short delay, we’re on it'
  if (e.running_over) return 'Taking a little longer than usual'
  const m = Number(e.minutes_left) || 0
  if (m < 60) return `About ${m} min left`
  const h = Math.floor(m / 60)
  return `About ${h} hr${m % 60 ? ` ${m % 60} min` : ''} left`
}

/**
 * The one card under the hero, depending on who is looking:
 * an order in progress or ready; signed out, an invitation; never
 * ordered, how it works; everything collected, nothing at all.
 */
function NowCard({ navigate }) {
  const { account, ready: accountReady } = useAccount()
  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => accountOrders().then(r => r.data),
    enabled: !!account,
    refetchInterval: 60_000,
  })

  if (!accountReady) return null

  if (!account) {
    return (
      <button onClick={() => navigate('/account')}
              className="mt-5 w-full flex items-center gap-3 p-3.5 rounded-2xl border border-rule
                         bg-white text-left active:bg-substrate">
        <span className="relative w-10 h-10 rounded-full bg-farhat/10 text-farhat grid
                         place-items-center shrink-0 ring-2 ring-gold">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <circle cx="12" cy="8" r="4.2" /><path d="M3.8 20.5a8.2 8.2 0 0 1 16.4 0z" />
          </svg>
          <span className="absolute -top-[2px] -left-[2px] w-[9px] h-[9px] rounded-full bg-gold
                           border-[1.5px] border-white" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold">Your orders, all in one place</span>
          <span className="block text-xs text-body mt-0.5">Sign in with your number to track them.</span>
        </span>
        <span className="shrink-0 px-3 py-1.5 rounded-full bg-farhat text-white text-xs font-bold">
          Sign in
        </span>
      </button>
    )
  }

  if (isLoading || !data) return null
  const { active = [], collected = [] } = data

  if (active.length > 0) {
    // A ready order matters most: it is waiting for them.
    const order = active.find(o => o.stage === 'ready') || active[0]
    const more = active.length - 1
    const open = () => navigate(`/track/${order.order_number}?t=${order.token}`)

    if (order.stage === 'ready') {
      return (
        <div className="mt-5 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60">
          <button onClick={open} className="w-full text-left">
            <span className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[0.7rem] font-bold">
                Ready to collect
              </span>
              <span className="text-[0.7rem] text-body">{order.order_number}</span>
            </span>
            <span className="block mt-2 text-sm font-bold">Your {order.summary} is ready</span>
            <span className="block text-xs text-body mt-0.5">
              Collect at {order.branch || 'Westland Branch'}
            </span>
          </button>
          <button onClick={() => window.open(BRANCH_MAP, '_blank')}
                  className="mt-3 w-full py-2.5 rounded-xl bg-farhat text-white text-sm font-bold">
            Directions
          </button>
          {more > 0 && (
            <button onClick={() => navigate('/orders')} className="mt-2 w-full text-xs font-semibold text-body">
              and {more} more order{more === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )
    }

    return (
      <div className="mt-5 p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60">
        <button onClick={open} className="w-full text-left">
          <span className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[0.7rem] font-bold">
              {STAGE_LABEL[order.stage] || 'In progress'}
            </span>
            <span className="text-[0.7rem] text-body">{order.order_number}</span>
          </span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block text-sm font-bold truncate">Your {order.summary}</span>
              <span className="block text-xs text-body mt-0.5">
                {timeLeft(order.estimate) || 'We’re on it'}
                {order.branch ? ` · ${order.branch.replace(' Branch', '')}` : ''}
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 text-body"
                 aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
          <span className="block mt-2.5 h-1.5 rounded-full bg-amber-100 overflow-hidden">
            <span className="block h-full rounded-full bg-farhat"
                  style={{ width: `${PROGRESS[order.stage] || 10}%` }} />
          </span>
        </button>
        {more > 0 && (
          <button onClick={() => navigate('/orders')} className="mt-2 w-full text-xs font-semibold text-body">
            and {more} more order{more === 1 ? '' : 's'}
          </button>
        )}
      </div>
    )
  }

  if (collected.length === 0) {
    const steps = [['1', 'Choose & upload', 'your file'], ['2', 'Pay with', 'mobile money'], ['3', 'Collect at', 'Westland']]
    return (
      <div className="mt-5 p-3.5 rounded-2xl border border-rule bg-white">
        <p className="text-sm font-bold">How it works</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {steps.map(([n, a, b]) => (
            <div key={n} className="text-center">
              <span className="mx-auto w-7 h-7 rounded-full bg-farhat text-white text-xs font-extrabold
                               grid place-items-center">{n}</span>
              <p className="mt-1.5 text-[0.7rem] font-bold leading-tight">{a}</p>
              <p className="text-[0.7rem] text-body leading-tight">{b}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // A returning customer with nothing on order: the shelves come straight up.
  return null
}

function Shelf({ title, services, navigate }) {
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={() => navigate('/categories')} className="text-sm font-semibold text-farhat">
          See all
        </button>
      </div>
      <div className="mt-3 -mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1
                      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {services.map(s => {
          const photo = serviceImage(s.base_name || s.name)
          return (
            <button key={s.id} onClick={() => navigate(`/service/${s.id}`)}
                    className="snap-start shrink-0 w-[150px] text-left rounded-2xl border border-rule
                               bg-white overflow-hidden active:bg-substrate">
              {photo ? (
                <img src={photo} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
              ) : (
                <div className="w-full aspect-[4/3] bg-substrate grid place-items-center">
                  <ServiceIcon name={s.name} className="w-7 h-7 text-body/60" />
                </div>
              )}
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{s.name}</p>
                {priceLine(s) && (
                  <p className="mt-1 text-xs font-semibold text-farhat">{priceLine(s)}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
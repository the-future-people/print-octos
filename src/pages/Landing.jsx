import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCatalogue, getOrder } from '../api/client'
import { ServiceIcon } from '../lib/icons.jsx'
import { loadOrder } from '../lib/order'
import logo from '../assets/farhat-logo.png'
import hero from '../assets/hero.png'

/**
 * What a customer sees on opening.
 *
 * Processed work first — banners, cards, stickers — because nobody goes
 * online to order a photocopy. They walk in. Online earns its place on
 * jobs worth planning ahead for, where the price and the turnaround are
 * worth knowing before leaving the house.
 *
 * The tiles are built around a photograph. Printing is bought by eye:
 * nobody orders a banner from a description. Until the catalogue has
 * real photographs the grey block stands in, and the page will look
 * thin — that is the photographs missing, not the layout.
 *
 * No account. Asking a stranger to register before they know what a job
 * costs loses them; the order's own token is what brings them back.
 */

function pricingBasis(unit) {
  if (unit === 'PER_SQFT' || unit === 'PER_SQCM') return 'Priced by size'
  if (unit === 'PER_JOB') return 'Priced per job'
  return 'Priced per piece'
}

export default function Landing() {
  const navigate = useNavigate()

  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const processed = services.filter(s => s.category === 'PRODUCTION')
  const bySize = unit => unit === 'PER_SQFT' || unit === 'PER_SQCM'

  // What is in the order they are already building, if any. A quiet
  // failure is right here: an expired or forgotten order should leave
  // the page working, not show an error on the way in.
  const saved = loadOrder()
  const { data: current } = useQuery({
    queryKey: ['order', saved?.order_number],
    queryFn: () => getOrder(saved.order_number, saved.access_token).then(r => r.data),
    enabled: !!saved,
    retry: false,
  })
  const itemCount = current?.line_items?.length ?? 0

  return (
    <div className="min-h-screen bg-white text-ink">

      <header className="bg-farhat">
        {/* A shade darker than the hero below, so the bar reads as its
            own band rather than floating in the red. */}
        <div className="bg-black/10">
          <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <img src={logo} alt="" className="h-11 w-auto" aria-hidden="true" />
            <p className="text-lg font-bold text-white leading-tight">
              Farhat<span className="font-normal text-white/85"> Printing Press</span>
            </p>
          </div>

          <nav className="flex items-center gap-4 text-sm text-white/90">
            <button className="hover:text-white transition-colors">
              Track an order
            </button>
            <button
              onClick={() => itemCount && navigate('/checkout')}
              aria-label={
                itemCount
                  ? `Your order, ${itemCount} item${itemCount === 1 ? '' : 's'}`
                  : 'Your order is empty'
              }
              className="relative p-1 rounded hover:text-white transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                   strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"
                   aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="18" cy="20" r="1.4" />
                <path d="M2 3h2.5l2.3 11.5a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full
                               bg-white text-farhat text-[0.6rem] font-bold leading-4
                               text-center tabular-nums">
                {itemCount}
              </span>
            </button>
          </nav>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-5 pt-7 pb-8 lg:flex lg:items-center lg:gap-10">
          <div className="lg:flex-1 lg:min-w-0">
          <p className="text-2xl sm:text-3xl font-bold text-white leading-tight text-balance">
            Order your printing <span className="text-gold">before you get here.</span>
          </p>
          <p className="mt-2 text-sm text-white/85 max-w-[46ch]">
            Pick what you need, see the price and the day it’s ready, and pay
            now. Collect at Westland.
          </p>

          {/* The button is a second way to do the same thing as Enter.
              Worth the space here: a customer who does not know the word
              for what they want needs the search to look like the way
              forward, not like a filter. */}
          <div className="mt-5 flex items-center gap-2 p-1.5 pl-4 rounded-full bg-white
                          focus-within:ring-2 focus-within:ring-white/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" className="w-4 h-4 shrink-0 text-body"
                 aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="What are you printing?"
              className="flex-1 min-w-0 bg-transparent text-[0.95rem]
                         placeholder:text-body/70 focus:outline-none
                         [&::-webkit-search-cancel-button]:hidden"
            />
            <button className="shrink-0 px-5 sm:px-6 py-2.5 rounded-full bg-farhat
                               text-white text-sm font-semibold hover:opacity-90
                               transition-opacity focus:outline-none
                               focus-visible:ring-2 focus-visible:ring-white">
              Search
            </button>
          </div>

          {/* The chips are the catalogue's own names, so tapping one is
              the same thing as finding it in the grid below. */}
          {processed.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1
                            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {processed.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/service/${s.id}`)}
                  className="shrink-0 inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5
                             rounded-full bg-white/15 text-white text-xs
                             hover:bg-white/25 transition-colors
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ServiceIcon name={s.name} className="w-3.5 h-3.5 shrink-0" />
                  {s.name}
                </button>
              ))}
            </div>
          )}
          </div>

          {/* Printing is bought by eye. Hidden on a phone, where it
              would push the search below the fold — the thing a
              customer came to use should not wait behind a picture. */}
          <div className="hidden lg:block lg:w-[32%] shrink-0">
            <img
              src={hero}
              alt=""
              className="w-full h-auto max-h-56 object-contain"
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 pb-12">

        <div className="mt-8 mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Order ahead</h2>
            <p className="mt-0.5 text-sm text-body">
              Pick something to get started, or browse everything we print.
            </p>
          </div>
          <button className="shrink-0 px-4 py-2 rounded-full border border-farhat
                             text-xs font-semibold text-farhat hover:bg-farhat
                             hover:text-white transition-colors">
            Browse all
          </button>
        </div>

        {isLoading && (
          <p className="py-10 text-sm text-body">Loading the catalogue…</p>
        )}

        {isError && (
          <p className="py-10 text-sm text-farhat">
            The catalogue didn’t load. Refresh the page to try again.
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {processed.map(service => (
            <button
              key={service.id}
              onClick={() => navigate(`/service/${service.id}`)}
              className="group flex flex-col text-left bg-white rounded-xl border
                         border-rule overflow-hidden hover:border-farhat
                         hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-ink
                         transition-all"
            >
              {service.image ? (
                <img
                  src={service.image}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="aspect-[4/3] w-full bg-substrate" />
              )}

              <div className="flex-1 flex flex-col px-3 py-3">
                <p className="text-[0.95rem] font-semibold leading-tight">
                  {service.name}
                </p>
                <p className="mt-1 text-xs leading-snug text-body line-clamp-3">
                  {service.description}
                </p>

                {/* The footer sits on the bottom edge of every card,
                    whatever the description's length, so the rules line
                    up across the row instead of stepping. */}
                <div className="mt-auto pt-3 flex items-center justify-between gap-2
                                border-t border-rule">
                  <span className={`inline-flex items-center gap-1.5 text-[0.7rem] ${
                    bySize(service.unit) ? 'text-farhat font-semibold' : 'text-body'
                  }`}>
                    <ServiceIcon name={service.name} className="w-3.5 h-3.5 shrink-0" />
                    {pricingBasis(service.unit)}
                  </span>
                  {/* Always visible. The tile is a button, and this is
                      what says so — hiding it until hover means it never
                      appears on a phone, where most of these are read. */}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-farhat text-white
                                   text-xs leading-none flex items-center justify-center
                                   group-hover:scale-110 transition-transform"
                        aria-hidden="true">
                    ›
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {!isLoading && !isError && processed.length === 0 && (
          <p className="py-10 text-sm text-body">
            Nothing to order ahead yet. Walk in and we’ll sort you out.
          </p>
        )}

        <section className="mt-6 rounded-xl bg-farhat/5 border border-farhat/20
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

      </main>
    </div>
  )
}
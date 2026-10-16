import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCatalogue } from '../api/client'
import { ServiceIcon } from '../lib/icons.jsx'
import { serviceImage } from '../lib/images'
import Header from '../components/Header.jsx'

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

export default function Landing() {
  const navigate = useNavigate()

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
        <div className="max-w-4xl mx-auto px-5 pt-7 pb-8">
          <p className="text-2xl sm:text-3xl font-bold text-white leading-tight
                        text-balance">
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
              the same thing as finding it in the grid below. Only what
              can be ordered now: a chip that leads nowhere is a let-down. */}
          {ready.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1
                            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ready.map(s => (
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

        {processed.length > 0 && (
          <Section
            title="Order ahead"
            note="Banners, stickers and cards: pick one to get started."
            services={processed}
            onOpen={id => navigate(`/service/${id}`)}
          />
        )}

        {documents.length > 0 && (
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
  const photo = serviceImage(service.name)

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
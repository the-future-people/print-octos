import { useQuery } from '@tanstack/react-query'
import { getCatalogue } from '../api/client'

/**
 * What a customer sees on opening.
 *
 * Processed work first — banners, cards, stickers — because nobody goes
 * online to order a photocopy. They walk in. Online earns its place on
 * jobs worth planning ahead for, where the price and the turnaround are
 * worth knowing before leaving the house.
 *
 * No headline. The red is the shop, and the search sits inside it, so
 * the first thing a customer does is the thing they came to do.
 */

function pricingBasis(unit) {
  if (unit === 'PER_SQFT' || unit === 'PER_SQCM') return 'Priced by size'
  if (unit === 'PER_JOB') return 'Priced per job'
  return 'Priced per piece'
}

export default function Landing() {
  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const processed = services.filter(s => s.category === 'PRODUCTION')
  const bySize = unit => unit === 'PER_SQFT' || unit === 'PER_SQCM'

  // A grid while everything fits on one screen; a row once it doesn't.
  // Four tiles are better seen all at once than swiped through, and a
  // wall of twenty is worse than a row of twenty.
  const asRow = processed.length > 6

  return (
    <div className="min-h-screen bg-white text-ink">

      <header className="bg-farhat px-5 pt-5 pb-6">
        <div className="max-w-xl mx-auto">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-bold text-white">
              Farhat<span className="font-normal text-white/85"> Printing Press</span>
            </p>
            <button className="shrink-0 text-xs text-white/90 underline underline-offset-4
                               decoration-white/40 hover:decoration-white transition-colors">
              Track an order
            </button>
          </div>

          <input
            type="search"
            placeholder="What are you printing?"
            className="mt-4 w-full px-4 py-3 rounded-lg bg-white text-[0.95rem]
                       placeholder:text-body/70 focus:outline-none
                       focus:ring-2 focus:ring-white/60"
          />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 pb-10">

        {/* The rule starts where the heading ends and carries the eye to
            the link, rather than sitting under the row as a border. */}
        <div className="mt-6 mb-3 flex items-center gap-3">
          <h2 className="shrink-0 text-base font-semibold">Order ahead</h2>
          <span className="flex-1 h-px bg-rule" aria-hidden="true" />
          <button className="shrink-0 text-xs font-semibold text-farhat
                             hover:underline underline-offset-4">
            Browse more
          </button>
        </div>

        {isLoading && (
          <p className="py-8 text-sm text-body">Loading the catalogue…</p>
        )}

        {isError && (
          <p className="py-8 text-sm text-farhat">
            The catalogue didn’t load. Refresh the page to try again.
          </p>
        )}

        <div className={asRow
          ? '-mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'grid grid-cols-2 gap-3'}>
          {processed.map(service => (
            <button
              key={service.id}
              className={`text-left bg-white rounded-xl border border-rule overflow-hidden
                         hover:border-ink focus:outline-none focus-visible:ring-2
                         focus-visible:ring-ink transition-colors
                         ${asRow ? 'shrink-0 w-[46%] sm:w-[200px] snap-start' : ''}`}
            >
              <div className="h-16 bg-substrate" />
              <div className="px-2.5 py-2">
                <p className="text-[0.9rem] font-semibold leading-tight">
                  {service.name}
                </p>
                <p className="mt-1 text-[0.72rem] leading-snug text-body line-clamp-2">
                  {service.description}
                </p>
                <p className={`mt-1.5 text-[0.68rem] ${
                  bySize(service.unit) ? 'text-farhat font-semibold' : 'text-body'
                }`}>
                  {pricingBasis(service.unit)}
                </p>
              </div>
            </button>
          ))}
        </div>

        {!isLoading && !isError && processed.length === 0 && (
          <p className="py-8 text-sm text-body">
            Nothing to order ahead yet. Walk in and we’ll sort you out.
          </p>
        )}

        <section className="mt-5 rounded-xl border border-rule border-l-4 border-l-farhat
                            px-4 py-3.5">
          <p className="text-[0.95rem] font-semibold">Not sure what it’s called?</p>
          <p className="mt-1 text-sm leading-relaxed text-body">
            Send a photo. We’ll tell you what it takes and what it costs.
          </p>
        </section>

        <footer className="mt-6 pt-5 border-t border-rule">
          <p className="text-sm text-body">
            Just need a photocopy? Walk in, or search above.
          </p>
        </footer>

      </main>
    </div>
  )
}
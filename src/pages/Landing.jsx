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
 * Instant services are reachable by search and not promoted.
 */
export default function Landing() {
  const { data: services = [], isLoading, isError } = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => getCatalogue().then(r => r.data),
  })

  const processed = services.filter(s => s.category === 'PRODUCTION')

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-6">

        <header className="flex items-center justify-between pb-4 border-b border-stone-200">
          <span className="text-base font-semibold text-stone-900">
            Farhat Printing Press
          </span>
        </header>

        <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-stone-300 bg-white">
          <span className="text-stone-400 text-sm">Photocopy, typing, lamination…</span>
        </div>

        <p className="mt-6 mb-3 text-xs uppercase tracking-wider text-stone-500">
          Order ahead
        </p>

        {isLoading && (
          <p className="text-sm text-stone-500">Loading…</p>
        )}

        {isError && (
          <p className="text-sm text-red-600">
            We couldn't load the catalogue. Try again in a moment.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {processed.map(service => (
            <button
              key={service.id}
              className="text-left rounded-xl border border-stone-200 bg-white overflow-hidden
                         hover:border-stone-400 transition-colors"
            >
              <div className="h-20 bg-stone-100" />
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium text-stone-900">{service.name}</p>
                <p className="mt-0.5 text-xs text-stone-500 leading-snug">
                  {service.description || '\u00A0'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {!isLoading && processed.length === 0 && (
          <p className="text-sm text-stone-500">Nothing to order ahead just yet.</p>
        )}

        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-3">
          <p className="text-sm font-medium text-amber-900">Not sure what it's called?</p>
          <p className="mt-1 text-xs text-amber-800">
            Send a photo of what you have. We'll tell you what it takes and what it costs.
          </p>
        </div>

        <p className="mt-4 pt-3 border-t border-stone-200 text-xs text-stone-500">
          Just need a photocopy? Walk in, or search above.
        </p>

      </div>
    </div>
  )
}
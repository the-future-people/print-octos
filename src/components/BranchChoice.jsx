import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBranchOptions } from '../api/client'
import BranchSearching from './BranchSearching.jsx'

/**
 * Where the job will be made, and when it will be ready.
 *
 * Shown as a choice rather than decided for them. One branch might
 * finish by four but sit across town; another is round the corner and
 * ready tomorrow. Only the customer knows which matters, so both
 * numbers are on the card and they pick.
 *
 * When nothing can be made, the branch-by-branch reasons are not what
 * a customer needs — six lines about machines they have never heard of
 * tell them nothing they can act on. What helps is which item is the
 * problem and what to do about it.
 */

// A floor, not an addition. An answer that arrives in 200ms would
// flash and look broken; one that takes three seconds is not made to
// take five.
const MINIMUM_WAIT = 2000

export default function BranchChoice({ name, order, chosen, onChoose, onRemoveItem }) {
  const [settled, setSettled] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['branches', order?.order_number],
    queryFn: () =>
      getBranchOptions(order.order_number, order.access_token).then(r => r.data),
    enabled: !!order,
    retry: false,
  })

  useEffect(() => {
    setSettled(false)
    const timer = setTimeout(() => setSettled(true), MINIMUM_WAIT)
    return () => clearTimeout(timer)
  }, [order?.order_number])

  if (isLoading || !settled) {
    return <BranchSearching name={name} />
  }

  if (isError) {
    return (
      <p className="mt-3 text-sm text-farhat">
        We couldn’t check the branches just now. Refresh to try again.
      </p>
    )
  }

  const options = data?.options || []
  const refusals = data?.refusals || []

  if (!options.length) {
    return <NothingAvailable refusals={refusals} onRemoveItem={onRemoveItem} />
  }

  return (
    <div className="mt-3 space-y-2">
      {options.map(option => {
        const picked = chosen === option.branch_id
        return (
          <button
            key={option.branch_id}
            onClick={() => onChoose(option)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-ink
                        ${picked
                          ? 'border-farhat bg-farhat/5'
                          : 'border-rule bg-white hover:border-ink'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{option.branch_name}</p>
                <p className="mt-0.5 text-xs text-body truncate">
                  {option.address}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {readyLabel(option)}
                </p>
                {option.distance_m != null && (
                  <p className="text-xs text-body tabular-nums">
                    {distanceLabel(option.distance_m)}
                  </p>
                )}
              </div>
            </div>

            {option.confidence === 'estimated' && (
              <p className="mt-2 text-xs text-body">
                An estimate — we’ll confirm once the floor picks it up.
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Nothing can make this.
 *
 * Deliberately not a list of branches. A customer reading "Madina
 * Branch has no large format printer" learns nothing they can use —
 * what they need is which item is stopping the order and the two
 * things they can actually do about it.
 *
 * And not "branches are busy", which would be a lie. Busy improves by
 * waiting; a missing machine does not, and a customer who waits an
 * hour on that wording finds the same wall.
 */
function NothingAvailable({ refusals, onRemoveItem }) {
  // The services named in the refusals, which is what the customer
  // recognises — they chose those, not the machines behind them.
  const blocked = [...new Set(
    refusals
      .map(r => r.service_name)
      .filter(Boolean),
  )]

  return (
    <div className="mt-3 rounded-xl border border-farhat/30 bg-farhat/5 px-4 py-4">
      <div className="flex gap-2.5">
        <svg viewBox="0 0 24 24" fill="currentColor"
             className="w-5 h-5 shrink-0 text-farhat mt-0.5" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0V8a1 1 0 0 1 1-1zm0 10.3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z" />
        </svg>

        <div className="min-w-0">
          <p className="text-sm font-bold text-farhat">
            We can’t make {blocked.length ? 'all of' : ''} this today
          </p>

          {blocked.length > 0 ? (
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              <span className="font-semibold text-ink">
                {blocked.join(' and ')}
              </span>
              {blocked.length === 1 ? ' isn’t' : ' aren’t'} something we can
              produce at any branch right now.
            </p>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              None of our branches can take this order as it stands.
            </p>
          )}

          <p className="mt-2 text-sm leading-relaxed text-body">
            Take it out and we’ll make the rest, or call us on{' '}
            <a href="tel:0300000000" className="font-semibold text-farhat">
              030 000 0000
            </a>{' '}
            and we’ll sort it out.
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex gap-2.5">
        {blocked.length === 1 && onRemoveItem && (
          <button
            onClick={() => onRemoveItem(blocked[0])}
            className="flex-1 px-4 py-2.5 rounded-lg bg-farhat text-white text-sm
                       font-semibold hover:opacity-90 transition-opacity"
          >
            Remove {blocked[0]}
          </button>
        )}
        <a
          href="tel:0300000000"
          className="flex-1 px-4 py-2.5 rounded-lg border border-farhat text-farhat
                     text-sm font-semibold text-center hover:bg-farhat
                     hover:text-white transition-colors"
        >
          Call the shop
        </a>
      </div>
    </div>
  )
}

function readyLabel(option) {
  const at = new Date(option.ready_at)
  const time = at.toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  if (!option.is_next_day) return `Ready ${time}`

  const day = at.toLocaleDateString('en-GB', { weekday: 'short' })
  return `${day} ${time}`
}

function distanceLabel(metres) {
  if (metres < 1000) return `${metres} m`
  return `${(metres / 1000).toFixed(1)} km`
}
import { useQuery } from '@tanstack/react-query'
import { getBranchOptions } from '../api/client'

/**
 * Where the job will be made, and when it will be ready.
 *
 * Shown as a choice rather than decided for them. One branch might
 * finish by four but sit across town; another is round the corner and
 * ready tomorrow. Only the customer knows which matters, so both
 * numbers are on the card and they pick.
 *
 * Where nothing can be made, the reasons are shown instead of an empty
 * space — a customer told the machine takes 1900mm can resize, and one
 * told nothing cannot.
 */
export default function BranchChoice({ order, chosen, onChoose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['branches', order?.order_number],
    queryFn: () =>
      getBranchOptions(order.order_number, order.access_token).then(r => r.data),
    enabled: !!order,
    retry: false,
  })

  if (isLoading) {
    return (
      <p className="mt-3 text-sm text-body">
        Finding a branch that can make this…
      </p>
    )
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
    return (
      <div className="mt-3 rounded-xl border border-farhat/30 bg-farhat/5 px-4 py-3.5">
        <p className="text-[0.95rem] font-semibold">
          We can’t make this one today
        </p>
        <ul className="mt-2 space-y-1">
          {refusals.map((r, i) => (
            <li key={i} className="text-sm leading-relaxed text-body">
              {r.reason}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-body">
          Change the size above, or call us on 030 000 0000.
        </p>
      </div>
    )
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
                          : 'border-rule hover:border-ink'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.95rem] font-semibold">{option.branch_name}</p>
                <p className="mt-0.5 text-xs text-body truncate">{option.address}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[0.95rem] font-semibold tabular-nums">
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
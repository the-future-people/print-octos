/**
 * The pause while Octos works out who can make this.
 *
 * Real work happens here — every branch checked for the machines each
 * service needs, then a ready time predicted for each one that can.
 * On a multi-branch order that is a genuine wait, and a frozen panel
 * makes it look like nothing is happening.
 *
 * Named, because being addressed makes a wait feel attended to rather
 * than empty.
 */
export default function BranchSearching({ name }) {
  return (
    <div className="mt-3 rounded-xl border border-rule bg-white px-4 py-4
                    flex items-center gap-3.5">
      <span className="relative w-10 h-10 shrink-0 grid place-items-center">
        <span className="absolute inset-0 rounded-full border-[1.5px]
                         border-farhat animate-[ping_1.8s_ease-out_infinite]" />
        <span className="absolute inset-0 rounded-full border-[1.5px]
                         border-farhat animate-[ping_1.8s_ease-out_0.6s_infinite]" />
        <span className="absolute inset-0 rounded-full border-[1.5px]
                         border-farhat animate-[ping_1.8s_ease-out_1.2s_infinite]" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
             strokeLinecap="round" strokeLinejoin="round"
             className="w-5 h-5 relative text-farhat" aria-hidden="true">
          <path d="M3 9l1.5-5h15L21 9" />
          <path d="M4 9h16v11H4z" />
          <path d="M9 20v-6h6v6" />
        </svg>
      </span>

      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {name ? `Hold on ${name}` : 'One moment'}
        </p>
        <p className="mt-0.5 text-xs text-body">
          Finding a branch that can print this
        </p>
      </div>
    </div>
  )
}
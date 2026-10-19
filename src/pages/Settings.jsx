// src/pages/Settings.jsx
//
// App settings. What it will hold is listed honestly as coming soon, so
// the screen says where things are going without pretending they work.

import Header from '../components/Header.jsx'

const SOON = [
  ['Notification preferences', 'Choose which messages you get'],
  ['App appearance', 'Light or dark'],
  ['Delete my account', 'Remove your account and its details'],
]

export default function Settings() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-4 py-5">
        <div className="rounded-2xl border border-rule divide-y divide-rule overflow-hidden">
          {SOON.map(([label, note]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3.5 bg-white">
              <span className="flex-1 min-w-0">
                <span className="block text-[0.95rem] font-semibold text-ink/60">{label}</span>
                <span className="block text-xs text-body mt-0.5">{note}</span>
              </span>
              <span className="shrink-0 px-2.5 py-1 rounded-full bg-substrate text-body text-[0.7rem] font-bold">
                Coming soon
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-center text-body">
          Need something changed now? Call us on 055 624 4194.
        </p>
      </main>
    </div>
  )
}
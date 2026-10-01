/**
 * A small icon for each kind of work.
 *
 * Matched on the service name, which means a service we have not
 * thought of gets the generic mark rather than nothing. That is the
 * trade: no migration, no admin field, and the fallback is quiet
 * rather than broken.
 */

const paths = {
  banner: 'M3 4h18v12H3z M7 16v4 M17 16v4',
  card: 'M3 6h18v12H3z M7 10h5 M7 14h3',
  sticker: 'M12 3a9 9 0 1 0 9 9h-6a3 3 0 0 1-3-3V3z',
  id: 'M4 5h16v14H4z M9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M7 16c0-2 4-2 4 0 M14 10h4 M14 13h4',
  sheet: 'M6 3h9l4 4v14H6z M15 3v4h4',
}

function pick(name = '') {
  const n = name.toLowerCase()
  if (n.includes('banner') || n.includes('flex')) return paths.banner
  if (n.includes('card')) return n.includes('id') ? paths.id : paths.card
  if (n.includes('sticker') || n.includes('sav') || n.includes('label')) return paths.sticker
  return paths.sheet
}

export function ServiceIcon({ name, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      <path d={pick(name)} />
    </svg>
  )
}
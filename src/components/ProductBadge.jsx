// src/components/ProductBadge.jsx
//
// A tiny picture of what the customer gets, for the chips on the red
// header: a sheet with its size printed on it and a dot for colour or
// black and white; a wide strip for a banner; a small card for business
// cards; a round sticker for stickers.
//
// Read from the product's own name, so a new A5 or A3 product gets the
// right badge without anyone drawing one.

const RAINBOW = 'conic-gradient(#F5A623 0 33%, #2b9bd8 0 66%, #3cb371 0)'

function kindOf(name = '') {
  const n = name.toLowerCase()
  if (/banner|flexy|flex\b/.test(n)) return { kind: 'banner' }
  if (/business card|\bcards?\b/.test(n)) return { kind: 'card' }
  if (/sticker|sav\b|vinyl/.test(n)) return { kind: 'sticker' }
  const size = (n.match(/\ba([3-6])\b/) || [])[1]
  const mono = /b&w|black|mono|grey|gray/.test(n)
  const colour = !mono && /colou?r|flyer|poster/.test(n)
  return { kind: 'sheet', size: size ? `A${size}` : null, dot: mono ? 'mono' : colour ? 'colour' : null }
}

export default function ProductBadge({ name, onLight = false }) {
  const k = kindOf(name)
  // On a pale tile the white shapes need an edge to be seen.
  const edge = onLight ? ' ring-1 ring-black/10' : ''

  if (k.kind === 'banner') {
    return (
      <span aria-hidden="true" className={`relative shrink-0 w-[30px] h-[14px] rounded-[3px] bg-white overflow-hidden${edge}`}>
        <span className="absolute inset-x-0 top-[4px] h-[6px] bg-farhat/80" />
      </span>
    )
  }

  if (k.kind === 'card') {
    return (
      <span aria-hidden="true" className={`relative shrink-0 w-[22px] h-[14px] rounded-[3px] bg-white${edge}`}>
        <span className="absolute left-[3px] top-[3px] w-[8px] h-[2px] rounded bg-farhat" />
        <span className="absolute left-[3px] top-[7px] w-[12px] h-[1.5px] rounded bg-ink/30" />
        <span className="absolute left-[3px] top-[10px] w-[9px] h-[1.5px] rounded bg-ink/30" />
      </span>
    )
  }

  if (k.kind === 'sticker') {
    return (
      <span aria-hidden="true" className={`relative shrink-0 w-[20px] h-[20px] rounded-full bg-white grid place-items-center${edge}`}>
        <span className="w-[10px] h-[10px] rounded-full border-2 border-farhat" />
      </span>
    )
  }

  // A sheet, a little wider for A3, with its size and a colour dot.
  return (
    <span aria-hidden="true"
          className={`relative shrink-0 h-[24px] ${k.size === 'A3' ? 'w-[22px]' : 'w-[19px]'}
                      rounded-[3px] bg-white grid place-items-center${edge}`}>
      {k.size && <span className="text-[8px] font-black leading-none text-ink">{k.size}</span>}
      {/* The folded corner. */}
      <span className="absolute top-0 right-0 w-[6px] h-[6px] rounded-bl-[2px]"
            style={{ background: 'linear-gradient(225deg, #E31E24 50%, #e7e3dc 50%)' }} />
      {k.dot && (
        <span className="absolute -bottom-[2px] -right-[3px] w-[9px] h-[9px] rounded-full border-[1.5px] border-farhat"
              style={{ background: k.dot === 'colour' ? RAINBOW : '#1a1a1a' }} />
      )}
    </span>
  )
}
// src/components/PagePicker.jsx
//
// Choosing pages: which to print, and how.
//
// A modal over the product page, so the choosing is its own place. Every
// page of the file as a thumbnail, labelled Page 1, Page 2..., about a
// dozen on screen and the rest a scroll away. Tap pages to choose them,
// then colour or black and white, one side or both, and copies, and add
// them as a set. A file can have several sets (page 1 in colour five
// times, the rest in black and white once); each is its own line, priced
// from its own pages.
//
// Pages already in a set show which, so nothing is printed twice by
// accident. An image is a single page and needs no picking: it opens
// straight on the settings.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { drawPage, isPdf } from '../lib/pdfPages'

const label = pages => {
  const p = [...pages].sort((a, b) => a - b)
  const runs = []
  for (let i = 0; i < p.length; i++) {
    let j = i
    while (j + 1 < p.length && p[j + 1] === p[j] + 1) j++
    runs.push(i === j ? `${p[i]}` : `${p[i]}–${p[j]}`)
    i = j
  }
  return runs.join(', ')
}

function Thumb({ file, number, chosen, inSet, onTap }) {
  const box = useRef(null)
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!isPdf(file)) { setSrc(URL.createObjectURL(file)); return undefined }
    let live = true
    const seen = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        seen.disconnect()
        drawPage(file, number).then(url => live && setSrc(url)).catch(() => {})
      }
    }, { rootMargin: '120px' })
    if (box.current) seen.observe(box.current)
    return () => { live = false; seen.disconnect() }
  }, [file, number])

  return (
    <button ref={box} type="button" onClick={onTap} className="text-center">
      <span className={`relative block aspect-[3/4] rounded-lg overflow-hidden bg-white
                        ${chosen ? 'ring-2 ring-farhat' : 'ring-1 ring-black/10'}`}>
        {src ? <img src={src} alt="" className="w-full h-full object-contain" />
             : <span className="absolute inset-0 animate-pulse bg-[#f3f1ec]" />}
        {chosen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-farhat text-white
                           grid place-items-center text-[0.65rem] font-black">✓</span>
        )}
        {inSet && !chosen && (
          <span className="absolute bottom-1 left-1 px-1.5 rounded bg-ink/70 text-white text-[0.55rem] font-bold">
            Set {inSet}
          </span>
        )}
      </span>
      <span className="mt-1 block text-[0.65rem] text-body">Page {number}</span>
    </button>
  )
}

function Seg({ options, value, onChange }) {
  return (
    <div className="flex p-0.5 rounded-full bg-[#f0eee9]">
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
                className={`flex-1 py-1.5 rounded-full text-xs font-bold
                            ${value === v ? 'bg-white text-ink shadow-sm' : 'text-body'}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

/**
 * file, pageCount   the file and its pages (from its check)
 * sets, onChange    this file's sets: [{ id, pages, colour, double, copies }]
 * canColour         whether colour and black and white are both on offer
 * defaults          { colour, double, copies } for a new set
 * priceOf           async (set) => total, for the price on the button
 */
export default function PagePicker({ file, pageCount, sets, onChange, onClose, canColour, defaults, priceOf, addons = [] }) {
  const count = Math.max(1, Number(pageCount) || 1)
  const numbers = useMemo(() => Array.from({ length: count }, (_, i) => i + 1), [count])
  const [chosen, setChosen] = useState(() => new Set(count === 1 ? [1] : []))
  const [colour, setColour] = useState(defaults.colour)
  const [double, setDouble] = useState(defaults.double)
  const [copies, setCopies] = useState(defaults.copies || 1)
  const [price, setPrice] = useState(null)
  // This set's own finishing: bound, laminated, in an envelope. Counted
  // per copy of this set (binding, envelopes) or per sheet (lamination).
  const [finish, setFinish] = useState(() => new Set())
  const [perCopy, setPerCopy] = useState({})
  const offered = addons.filter(a => a.available)
  const finishing = [...finish].map(id => {
    const a = offered.find(x => x.id === id)
    return a?.packing ? { service: id, per_copy: perCopy[id] ?? true } : id
  })

  const setOf = useMemo(() => {
    const map = {}
    sets.forEach((s, i) => s.pages.forEach(p => { map[p] = i + 1 }))
    return map
  }, [sets])

  const draft = { pages: [...chosen].sort((a, b) => a - b), colour, double, copies, addons: finishing }
  useEffect(() => {
    if (!chosen.size) { setPrice(null); return undefined }
    let live = true
    const t = setTimeout(() => { priceOf(draft).then(v => live && setPrice(v)).catch(() => live && setPrice(null)) }, 300)
    return () => { live = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, colour, double, copies, finish, perCopy])

  const toggle = n => setChosen(prev => {
    const next = new Set(prev)
    next.has(n) ? next.delete(n) : next.add(n)
    return next
  })

  function addSet() {
    if (!chosen.size) return
    onChange([...sets, { id: crypto.randomUUID(), ...draft }])
    setChosen(new Set())
    setFinish(new Set())
  }

  // The commonest mix: page one in colour, the rest in black and white.
  function firstColourRestMono() {
    const rest = numbers.slice(1)
    const made = [{ id: crypto.randomUUID(), pages: [1], colour: true, double, copies }]
    if (rest.length) made.push({ id: crypto.randomUUID(), pages: rest, colour: false, double, copies })
    onChange(made)
    setChosen(new Set())
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45" onClick={onClose}>
      <div className="bg-white rounded-t-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <span className="block mx-auto mt-2 mb-1 w-10 h-1.5 rounded-full bg-[#ddd]" />
        <div className="px-4 flex items-baseline justify-between gap-3">
          <p className="text-sm font-extrabold truncate">{file.name}</p>
          <p className="text-[0.7rem] text-body shrink-0">{count} page{count === 1 ? '' : 's'}{count > 1 ? ' · tap to choose' : ''}</p>
        </div>

        {count > 1 && (
          <div className="px-4 pt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setChosen(new Set(numbers))}
                    className="px-2.5 py-1 rounded-full border border-[#e5e2dc] text-[0.7rem] font-bold">All pages</button>
            {canColour && (
              <button type="button" onClick={firstColourRestMono}
                      className="px-2.5 py-1 rounded-full border border-[#e5e2dc] text-[0.7rem] font-bold">
                First page colour, rest B&amp;W
              </button>
            )}
            <button type="button" onClick={() => setChosen(new Set())}
                    className="px-2.5 py-1 rounded-full border border-[#e5e2dc] text-[0.7rem] font-bold">Clear</button>
          </div>
        )}

        {sets.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-1.5">
            {sets.map((s, i) => (
              <span key={s.id} className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[0.68rem] font-bold
                                           ${s.colour ? 'bg-[#fdecec] text-[#b91c1c]' : 'bg-[#f3f1ec] text-ink/70'}`}>
                Set {i + 1}: p.{label(s.pages)} · {s.colour ? 'Colour' : 'B&W'}{s.double ? ' · both sides' : ''} ×{s.copies}
                {s.addons?.length ? ` · +${s.addons.length} finishing` : ''}
                <button type="button" aria-label={`Remove set ${i + 1}`}
                        onClick={() => onChange(sets.filter(x => x.id !== s.id))}
                        className="w-4 h-4 grid place-items-center rounded hover:bg-black/10">×</button>
              </span>
            ))}
          </div>
        )}

        {count > 1 && (
          <div className="mt-2 px-4 grid grid-cols-4 gap-2.5 overflow-y-auto" style={{ maxHeight: '42vh' }}>
            {numbers.map(n => (
              <Thumb key={n} file={file} number={n} chosen={chosen.has(n)} inSet={setOf[n]} onTap={() => toggle(n)} />
            ))}
          </div>
        )}
        {count === 1 && (
          <div className="mx-auto mt-2 w-28"><Thumb file={file} number={1} chosen inSet={null} onTap={() => {}} /></div>
        )}

        <div className="mt-2 border-t border-[#f0ede8] bg-[#fafaf8] px-4 pt-3 pb-3 space-y-2">
          <p className="text-xs font-extrabold">
            {chosen.size ? `Page${chosen.size === 1 ? '' : 's'} ${label(chosen)} chosen` : 'Choose pages above'}
          </p>
          {canColour && <Seg options={[[true, 'Colour'], [false, 'Black & white']]} value={colour} onChange={setColour} />}
          <Seg options={[[false, 'One side'], [true, 'Both sides']]} value={double} onChange={setDouble} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Copies</span>
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => setCopies(c => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded-lg bg-[#f0eee9] text-lg">−</button>
              <span className="w-6 text-center font-bold tabular-nums">{copies}</span>
              <button type="button" onClick={() => setCopies(c => c + 1)}
                      className="w-8 h-8 rounded-lg bg-farhat/10 text-farhat text-lg">+</button>
            </span>
          </div>
          {offered.length > 0 && (
            <div className="pt-1">
              <p className="text-[0.7rem] font-bold text-body uppercase tracking-wider">Finishing for this set</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {offered.map(a => {
                  const on = finish.has(a.id)
                  return (
                    <button key={a.id} type="button"
                            onClick={() => setFinish(prev => { const n = new Set(prev); on ? n.delete(a.id) : n.add(a.id); return n })}
                            className={`px-2.5 py-1 rounded-full text-[0.7rem] font-bold border
                                        ${on ? 'bg-farhat text-white border-farhat' : 'border-[#e5e2dc] text-ink'}`}>
                      {on ? '✓ ' : ''}{a.name.replace(/^A[3-5]\s+/, '')}
                    </button>
                  )
                })}
              </div>
              {offered.filter(a => a.packing && finish.has(a.id)).map(a => (
                <div key={a.id} className="mt-1.5">
                  <Seg options={[[true, 'One per copy'], [false, 'One for this set']]}
                       value={perCopy[a.id] ?? true} onChange={v => setPerCopy(m => ({ ...m, [a.id]: v }))} />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-[#e5e2dc] text-sm font-bold">Done</button>
            <button type="button" onClick={addSet} disabled={!chosen.size}
                    className="flex-[1.4] py-2.5 rounded-xl bg-farhat text-white text-sm font-extrabold disabled:opacity-40">
              Add as a set{price ? ` · GHS ${price}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
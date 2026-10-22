// src/components/ArtworkBatch.jsx
//
// Several files for one product, each checked on its own.
//
// A customer printing documents often has more than one: a programme, an
// agenda, a set of slides. Each file goes through exactly the check a
// single upload does (sent with progress, opened, measured, judged, the
// verdict signed), two at a time so a phone on mobile data is not
// swamped. The product's settings apply to every file; each becomes its
// own line in the cart, priced from its own pages.
//
// The list lives with the page (items / setItems), because the page
// prices the files and adds them to the cart. This component sends them
// and shows how each is doing.

import { useEffect, useRef, useState } from 'react'
import { checkArtwork } from '../api/client'
import ArtworkPreview from './ArtworkPreview.jsx'

export const BATCH_LIMIT = 15
const AT_ONCE = 2

let counter = 0
const newKey = () => crypto.randomUUID().replace(/-/g, '')

export function newItem(file) {
  counter += 1
  return { id: `f${Date.now()}-${counter}`, file, status: 'waiting', progress: 0,
           result: null, problem: '', key: newKey(), attempt: 0 }
}

// Back to waiting, to be checked again (a retry, or the product's
// settings changed under it). A new attempt, so it is sent once more.
export const recheck = item => ({ ...item, status: 'waiting', progress: 0, problem: '',
                                  result: null, attempt: (item.attempt || 0) + 1 })

const TONE = {
  fine: { text: 'text-emerald-700', label: 'Good to print' },
  warn: { text: 'text-amber-700', label: 'Worth a look first' },
  refuse: { text: 'text-farhat', label: 'We can’t print this one' },
}

function Row({ item, price, onRemove, onRetry }) {
  const [open, setOpen] = useState(false)
  const tone = item.result ? TONE[item.result.verdict] : null
  const pages = Number(item.result?.page_count) || 0
  const notes = (item.result?.checks || []).filter(c => c.verdict !== 'fine')

  return (
    <div className={`rounded-xl border ${item.result?.verdict === 'refuse' ? 'border-farhat/30' : 'border-rule'} bg-white`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <ArtworkPreview file={item.file} tone={item.result?.verdict} />
        <button type="button" onClick={() => notes.length && setOpen(o => !o)}
                className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium truncate">{item.file.name}</p>
          {item.status === 'waiting' && <p className="text-xs text-body">Waiting to send…</p>}
          {item.status === 'sending' && (
            <p className="text-xs text-body tabular-nums">
              {item.progress < 100 ? `Sending · ${item.progress}%` : 'Checking it prints well…'}
            </p>
          )}
          {item.status === 'failed' && <p className="text-xs text-farhat">{item.problem}</p>}
          {item.status === 'done' && tone && (
            <p className={`text-xs font-semibold ${tone.text}`}>
              {pages ? `${pages} page${pages === 1 ? '' : 's'} · ` : ''}{tone.label}
              {notes.length > 0 && <span className="font-normal text-body"> · {open ? 'hide' : 'why'}</span>}
            </p>
          )}
          {item.status === 'sending' && (
            <span className="mt-1.5 block h-[3px] rounded-full bg-substrate overflow-hidden">
              <span className="block h-full bg-farhat rounded-full transition-all duration-300"
                    style={{ width: `${item.progress < 100 ? Math.max(6, item.progress * 0.7) : 88}%` }} />
            </span>
          )}
        </button>
        {price && item.status === 'done' && item.result?.verdict !== 'refuse' && (
          <span className="text-sm font-bold tabular-nums shrink-0">GHS {price}</span>
        )}
        {item.status === 'failed' ? (
          <button type="button" onClick={onRetry}
                  className="shrink-0 text-xs font-semibold text-farhat">Retry</button>
        ) : null}
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.file.name}`}
                className="shrink-0 w-7 h-7 grid place-items-center rounded-full text-body hover:bg-substrate">×</button>
      </div>
      {open && notes.length > 0 && (
        <ul className="px-3.5 pb-3 -mt-1 space-y-1.5">
          {notes.map((c, i) => <li key={i} className="text-xs leading-relaxed text-ink/80">• {c.message}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function ArtworkBatch({ service, specifications, items, setItems, prices = {} }) {
  const input = useRef(null)
  const started = useRef(new Set())
  const [notice, setNotice] = useState('')
  const room = BATCH_LIMIT - items.length

  // Two at a time: as one finishes, the next waiting file goes.
  useEffect(() => {
    if (!service) return
    const sending = items.filter(i => i.status === 'sending').length
    const next = items.filter(i => i.status === 'waiting').slice(0, Math.max(0, AT_ONCE - sending))
    next.forEach(item => {
      // Once per file per attempt, however often this effect runs.
      const tag = `${item.id}:${item.attempt || 0}`
      if (started.current.has(tag)) return
      started.current.add(tag)
      const update = patch => setItems(list => list.map(i => (i.id === item.id ? { ...i, ...patch } : i)))
      update({ status: 'sending', progress: 0, problem: '' })
      checkArtwork(item.file, service.id, specifications, percent => update({ progress: percent }))
        .then(({ data }) => update({ status: 'done', result: data }))
        .catch(err => update({
          status: 'failed',
          problem: err.response?.data?.detail || 'We couldn’t read that file. Try again.',
        }))
    })
  }, [items, service, specifications, setItems])

  function add(files) {
    const picked = Array.from(files || [])
    if (!picked.length) return
    const taken = picked.slice(0, Math.max(0, room))
    setNotice(picked.length > taken.length
      ? `Only ${BATCH_LIMIT} files at once: the first ${taken.length} were added.`
      : '')
    setItems(list => [...list, ...taken.map(newItem)])
  }

  return (
    <div className="mt-3">
      <input ref={input} type="file" multiple className="hidden"
             accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.webp"
             onChange={e => { const f = e.target.files; add(f); e.target.value = '' }} />

      <div className="space-y-2">
        {items.map(item => (
          <Row key={item.id} item={item} price={prices[item.id]}
               onRemove={() => setItems(list => list.filter(i => i.id !== item.id))}
               onRetry={() => setItems(list => list.map(i => (i.id === item.id ? recheck(i) : i)))} />
        ))}
      </div>

      {room > 0 && (
        <button type="button" onClick={() => input.current?.click()}
                className={`w-full rounded-xl border-[1.5px] border-dashed border-farhat/60 bg-farhat/5
                            text-farhat font-semibold transition-colors hover:bg-farhat/10
                            ${items.length ? 'mt-2 py-3 text-sm' : 'py-6 text-[0.95rem]'}`}>
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
              <path d="M7 16a4 4 0 0 1-.9-7.9 5.5 5.5 0 0 1 10.6-1.3A4.2 4.2 0 0 1 18 16h-1" />
              <path d="M12 12v8" /><path d="M9 15l3-3 3 3" />
            </svg>
            {items.length ? 'Add more files' : 'Add files'}
          </span>
          <span className="block mt-1 text-xs font-normal text-body">
            {items.length
              ? `${items.length} of ${BATCH_LIMIT}`
              : `Up to ${BATCH_LIMIT} at once · PDF, JPEG, PNG, TIFF or WEBP`}
          </span>
        </button>
      )}
      {room <= 0 && (
        <p className="mt-2 text-xs text-body text-center">That’s {BATCH_LIMIT} files, the most at once.</p>
      )}
      {notice && <p className="mt-2 text-xs text-amber-700">{notice}</p>}
    </div>
  )
}
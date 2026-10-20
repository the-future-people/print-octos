// src/pages/Board.jsx
//
// The waiting-area board, for a TV in the shop: an airport-style screen.
//
// Opened once at /board/WLB?key=… on any screen with a browser; from then
// on it looks after itself. It asks every 5 seconds; shows what is being
// made (with when it will be ready and where it is on the floor) and,
// wider, what is ready to collect (and since when). A newly ready order
// flashes green with a chime. When a side has more than fits, it pages,
// every 8 seconds, and says so. Full order numbers with the last digits
// lit, the service, never a name, phone or PIN.
//
// Browsers only allow sound after a tap, so it opens on a Start screen:
// one tap for full screen and the chime, and nobody touches it again.

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import client from '../api/client'

const ROWS = 6
const time = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })

// "4:00 pm" today, "Yesterday 4:00 pm", "Fri 1:10 pm" earlier in the week,
// "14 Oct" beyond: never a bare time that could be any day.
function since(iso) {
  const at = new Date(iso)
  const today = new Date()
  const days = Math.floor((new Date(today.toDateString()) - new Date(at.toDateString())) / 86400000)
  if (days <= 0) return time(iso)
  if (days === 1) return `Yesterday ${time(iso)}`
  if (days < 7) return `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${time(iso)}`
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// A time already past is not a promise: say it is running late.
const readyAbout = iso => (new Date(iso) < new Date() ? 'Running late' : time(iso))

function chime(ctx) {
  if (!ctx) return
  const t = ctx.currentTime
  ;[[880, 0], [1320, 0.18]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t + at)
    gain.gain.exponentialRampToValueAtTime(0.25, t + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t + at)
    osc.stop(t + at + 0.65)
  })
}

// The full number, the part that tells orders apart lit up.
function Num({ n, ready, small }) {
  const cut = Math.max(0, n.length - 3)
  return (
    <span className={`font-extrabold tracking-wide text-[#d9d9d9] whitespace-nowrap pr-[0.8vw]
                      ${small ? 'text-[1.2vw]' : 'text-[1.45vw]'}`}>
      {n.slice(0, cut)}
      <em className={`not-italic font-black ${ready ? 'text-[#4ade80] text-[2vw]' : small ? 'text-[#fbbf24] text-[1.5vw]' : 'text-[#fbbf24] text-[1.75vw]'}`}>
        {n.slice(cut)}
      </em>
    </span>
  )
}

// Pages through a list that does not fit, every 8 seconds.
function usePages(list) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(list.length / ROWS))
  useEffect(() => {
    if (pages < 2) { setPage(0); return undefined }
    const t = setInterval(() => setPage(p => (p + 1) % pages), 8000)
    return () => clearInterval(t)
  }, [pages])
  const at = Math.min(page, pages - 1)
  return { rows: list.slice(at * ROWS, at * ROWS + ROWS), page: at, pages }
}

function Pager({ page, pages, colour }) {
  return (
    <div className="mt-auto flex items-center justify-between px-[1.2vw] py-[0.8vh] text-[0.95vw] text-[#8a8a8a]">
      <span>{pages > 1 ? `Page ${page + 1} of ${pages}` : 'All shown'}</span>
      <span className="flex gap-[0.4vw]">
        {Array.from({ length: pages }, (_, i) => (
          <i key={i} className="w-[0.55vw] h-[0.55vw] rounded-full"
             style={{ background: i === page ? colour : '#444' }} />
        ))}
      </span>
    </div>
  )
}

export default function Board() {
  const { branch } = useParams()
  const [params] = useSearchParams()
  const key = params.get('key') || ''

  const [data, setData] = useState(null)
  const [live, setLive] = useState(true)
  const [problem, setProblem] = useState('')
  const [started, setStarted] = useState(false)
  const [now, setNow] = useState(new Date())
  const [fresh, setFresh] = useState(() => new Set())
  const seen = useRef(null)
  const audio = useRef(null)

  useEffect(() => {
    let alive = true
    const ask = () => client.get(`/api/v1/storefront/board/${branch}/`, { params: { key } })
      .then(({ data: d }) => {
        if (!alive) return
        setData(d); setLive(true); setProblem('')
        const readyNow = new Set(d.ready.map(r => r.number))
        if (seen.current) {
          const arrived = [...readyNow].filter(n => !seen.current.has(n))
          if (arrived.length) {
            chime(audio.current)
            setFresh(prev => new Set([...prev, ...arrived]))
            setTimeout(() => setFresh(prev => {
              const next = new Set(prev); arrived.forEach(n => next.delete(n)); return next
            }), 15000)
          }
        }
        seen.current = readyNow
      })
      .catch(err => {
        if (!alive) return
        setLive(false)
        setProblem(err.response?.data?.detail || '')
      })
    ask()
    const t = setInterval(ask, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [branch, key])

  // The clock ticks every second: a still clock on a TV means a stuck page.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  function start() {
    try {
      audio.current = new (window.AudioContext || window.webkitAudioContext)()
      chime(audio.current)
    } catch { /* a silent board still works */ }
    document.documentElement.requestFullscreen?.().catch(() => {})
    setStarted(true)
  }

  const making = data?.making || []
  // The newest ready ones first, and any just arrived at the very top.
  const ready = [...(data?.ready || [])].sort((a, b) => (fresh.has(b.number) ? 1 : 0) - (fresh.has(a.number) ? 1 : 0))
  const left = usePages(making)
  const right = usePages(ready)

  const hm = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?(am|pm)$/i, '')
  const ampm = now.getHours() < 12 ? 'AM' : 'PM'
  const ss = String(now.getSeconds()).padStart(2, '0')
  const day = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()

  return (
    <div className="fixed inset-0 bg-[#121212] text-white flex flex-col select-none cursor-default">
      <header className="flex items-center justify-between px-[2vw] py-[1vh]"
              style={{ background: 'linear-gradient(180deg,#e31e24,#c4141a)' }}>
        <p className="font-black text-[3.4vw] leading-none tracking-tight">Farhat Printing Press</p>
        <div className="text-right border-l border-white/35 pl-[1.6vw]">
          <p className="text-[0.95vw] tracking-[0.18em] opacity-90">{day}</p>
          <p className="font-black leading-none tabular-nums">
            <span className="text-[3.2vw]">{hm}</span>
            <span className="text-[1.9vw] opacity-85">:{ss}</span>
            <span className="text-[1.5vw] ml-[0.4vw]">{ampm}</span>
          </p>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-[1fr_1.35fr] gap-[0.8vw] p-[0.8vw]">
        {/* Being made */}
        <section className="bg-[#1b1b1b] rounded-[0.8vw] overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center gap-[0.8vw] px-[1.2vw] py-[1vh] bg-[#fbbf24] text-[#111]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                 strokeLinejoin="round" className="w-[2vw] h-[2vw]" aria-hidden="true">
              <path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" />
            </svg>
            <span className="flex-1 text-[2vw] font-black tracking-wide">BEING MADE</span>
            <span className="text-right leading-none">
              <b className="block text-[2.4vw] font-black">{making.length}</b>
              <small className="text-[0.8vw] tracking-widest">ORDERS</small>
            </span>
          </div>
          <div className="grid grid-cols-[1.85fr_1.2fr_0.85fr_0.8fr] px-[1.2vw] py-[0.7vh] text-[0.85vw] tracking-widest text-[#9a9a9a] border-b border-[#2a2a2a]">
            <span>ORDER</span><span>SERVICE</span><span>READY ABOUT</span><span>STAGE</span>
          </div>
          {left.rows.map(m => (
            <div key={m.number} className="grid grid-cols-[1.85fr_1.2fr_0.85fr_0.8fr] items-center px-[1.2vw] py-[1.25vh] border-b border-[#262626] text-[1.25vw]">
              <Num n={m.number} small />
              <span className="truncate pr-[0.6vw]">{m.service}</span>
              <span className={`tabular-nums ${m.ready_about && new Date(m.ready_about) < new Date() ? 'text-[#fbbf24]' : ''}`}>
                {m.ready_about ? readyAbout(m.ready_about) : '—'}
              </span>
              <span className="justify-self-start text-[1vw] font-extrabold px-[0.8vw] py-[0.35vh] rounded-full bg-[#3b2a0b] text-[#fbbf24]">{m.stage}</span>
            </div>
          ))}
          {!data && <p className="px-[1.2vw] py-[3vh] text-[1.3vw] text-[#8a8a8a]">Connecting to the shop…</p>}
          {data && making.length === 0 && <p className="px-[1.2vw] py-[3vh] text-[1.3vw] text-[#8a8a8a]">Nothing in the queue.</p>}
          <Pager page={left.page} pages={left.pages} colour="#fbbf24" />
        </section>

        {/* Ready to collect */}
        <section className="bg-[#1b1b1b] rounded-[0.8vw] overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center gap-[0.8vw] px-[1.2vw] py-[1vh] bg-[#16a34a]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                 strokeLinejoin="round" className="w-[2vw] h-[2vw]" aria-hidden="true">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
            </svg>
            <span className="flex-1 text-[2vw] font-black tracking-wide">READY TO COLLECT</span>
            <span className="text-right leading-none">
              <b className="block text-[2.4vw] font-black">{ready.length}</b>
              <small className="text-[0.8vw] tracking-widest">ORDERS</small>
            </span>
          </div>
          <div className="grid grid-cols-[1.45fr_1.55fr_0.95fr] px-[1.2vw] py-[0.7vh] text-[0.85vw] tracking-widest text-[#9a9a9a] border-b border-[#2a2a2a]">
            <span>ORDER</span><span>SERVICE</span><span>READY SINCE</span>
          </div>
          {right.rows.map(r => {
            const isNew = fresh.has(r.number)
            return (
              <div key={r.number}
                   className={`grid grid-cols-[1.45fr_1.55fr_0.95fr] items-center px-[1.2vw] py-[1.25vh] border-b border-[#262626]
                               text-[1.35vw] transition-colors duration-700 ${isNew ? 'bg-[#15803d] animate-pulse' : ''}`}>
                <span className={isNew ? '[&_*]:!text-white' : ''}><Num n={r.number} ready /></span>
                <span className="truncate pr-[0.6vw]">{r.service}</span>
                <span className="tabular-nums">{isNew ? 'just now ✦' : since(r.since)}</span>
              </div>
            )
          })}
          {!data && <p className="px-[1.2vw] py-[3vh] text-[1.3vw] text-[#8a8a8a]">Connecting to the shop…</p>}
          {data && ready.length === 0 && <p className="px-[1.2vw] py-[3vh] text-[1.3vw] text-[#8a8a8a]">Nothing waiting yet.</p>}
          <Pager page={right.page} pages={right.pages} colour="#4ade80" />
        </section>
      </main>

      <footer className="flex items-center gap-[1vw] bg-[#0d0d0d] px-[1.6vw] py-[1vh] text-[1.3vw]">
        <span className="w-[2vw] h-[2vw] rounded-full bg-[#e31e24] grid place-items-center font-black text-[1.2vw] shrink-0">!</span>
        <span>Please have your <b>phone number</b> and <b>collection PIN</b> ready at the counter.</span>
        <span className="ml-auto flex items-center gap-[0.6vw] text-[1vw] text-[#bbb]">
          <i className={`w-[0.8vw] h-[0.8vw] rounded-full ${live ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
          {live ? 'Live updates connected' : (problem || 'Reconnecting…')}
        </span>
      </footer>

      {!started && (
        <button onClick={start} className="absolute inset-0 bg-black/85 text-white grid place-items-center text-center">
          <span>
            <span className="block text-[3vw] font-black">Start the board</span>
            <span className="block mt-[1vh] text-[1.4vw] opacity-80">Tap once: full screen, with the chime switched on</span>
          </span>
        </button>
      )}
    </div>
  )
}
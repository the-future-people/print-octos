// src/pages/Board.jsx
//
// The waiting-area board, for a TV in the shop.
//
// Opened once at /board/WLB?key=… on any screen with a browser; from then
// on it looks after itself: it asks every 5 seconds, shows what is being
// made and what is ready, and when a number turns ready it lights up and
// chimes. Short numbers only — no names, no phones, no PINs.
//
// Browsers do not let a page make sound until someone has touched it, so
// it opens on a "Start" screen: one tap switches on the sound and goes
// full screen, and nobody needs to touch it again.

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import client from '../api/client'

const clock = d => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })

function chime(ctx) {
  if (!ctx) return
  const now = ctx.currentTime
  ;[[880, 0], [1320, 0.18]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now + at)
    gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now + at)
    osc.stop(now + at + 0.65)
  })
}

export default function Board() {
  const { branch } = useParams()
  const [params] = useSearchParams()
  const key = params.get('key') || ''

  const [data, setData] = useState(null)
  const [problem, setProblem] = useState('')
  const [started, setStarted] = useState(false)
  const [now, setNow] = useState(new Date())
  const [fresh, setFresh] = useState(() => new Set())
  const seen = useRef(null)
  const audio = useRef(null)

  // Ask every 5 seconds; keep the last good board if one request fails.
  useEffect(() => {
    let live = true
    const ask = () => client.get(`/api/v1/storefront/board/${branch}/`, { params: { key } })
      .then(({ data: d }) => {
        if (!live) return
        setData(d)
        setProblem('')
        const readyNow = new Set(d.ready.map(r => r.n))
        if (seen.current) {
          const arrived = [...readyNow].filter(n => !seen.current.has(n))
          if (arrived.length) {
            chime(audio.current)
            setFresh(prev => new Set([...prev, ...arrived]))
            setTimeout(() => setFresh(prev => {
              const next = new Set(prev); arrived.forEach(n => next.delete(n)); return next
            }), 12000)
          }
        }
        seen.current = readyNow
      })
      .catch(err => live && setProblem(err.response?.data?.detail || 'Reconnecting…'))
    ask()
    const t = setInterval(ask, 5000)
    return () => { live = false; clearInterval(t) }
  }, [branch, key])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
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
  const ready = data?.ready || []

  return (
    <div className="fixed inset-0 bg-white text-ink flex flex-col select-none cursor-default">
      <header className="bg-farhat text-white flex items-center justify-between px-[3vw] py-[1.6vh]">
        <p className="font-black text-[2.4vw] leading-none">Farhat Printing Press</p>
        <p className="text-[1.5vw] opacity-90">Watch for your order number · {clock(now)}</p>
      </header>

      <main className="flex-1 grid grid-cols-[1fr_1.25fr] min-h-0">
        <section className="px-[3vw] py-[3vh] border-r border-[#f0ede8] min-h-0 overflow-hidden">
          <h2 className="flex items-center gap-[0.8vw] text-[1.6vw] font-black tracking-wider text-amber-700">
            <span className="w-[0.9vw] h-[0.9vw] rounded-full bg-amber-500" /> BEING MADE
          </h2>
          <ul className="mt-[2vh]">
            {making.map(m => (
              <li key={m.n} className="flex items-baseline justify-between py-[1.3vh] border-b border-[#f0ede8]">
                <span className="text-[3.6vw] font-black tracking-wide tabular-nums leading-none">{m.n}</span>
                <span className="text-[1.3vw] text-body">
                  {m.ready_about ? `ready about ${clock(new Date(m.ready_about))}` : m.stage}
                </span>
              </li>
            ))}
            {making.length === 0 && <li className="py-[3vh] text-[1.4vw] text-body">Nothing in the queue.</li>}
          </ul>
        </section>

        <section className="px-[3vw] py-[3vh] bg-[#f6fbf8] min-h-0 overflow-hidden">
          <h2 className="flex items-center gap-[0.8vw] text-[1.6vw] font-black tracking-wider text-green-700">
            <span className="w-[0.9vw] h-[0.9vw] rounded-full bg-green-600" /> READY TO COLLECT
          </h2>
          <div className="mt-[2.5vh] grid grid-cols-4 gap-[1.2vw]">
            {ready.map(r => (
              <span key={r.n}
                    className={`text-center rounded-[1.2vw] py-[2.2vh] text-[4vw] font-black tabular-nums leading-none
                                border-[0.25vw] transition-all duration-700
                                ${fresh.has(r.n)
                                  ? 'bg-green-600 text-white border-green-600 scale-105 shadow-[0_0_0_0.6vw_rgba(22,163,74,0.25)]'
                                  : 'bg-[#e8f7ee] text-[#0d5c33] border-[#b7e4c7]'}`}>
                {r.n}
              </span>
            ))}
          </div>
          {ready.length === 0 && <p className="mt-[3vh] text-[1.4vw] text-body">Nothing waiting yet.</p>}
          <p className="mt-[3vh] text-[1.3vw] text-ink/70">
            Bring your phone number and collection PIN to the counter.
          </p>
        </section>
      </main>

      {problem && (
        <p className="absolute bottom-[1.5vh] left-1/2 -translate-x-1/2 px-[1.2vw] py-[0.6vh] rounded-full
                      bg-ink/80 text-white text-[1vw]">{problem}</p>
      )}

      {!started && (
        <button onClick={start}
                className="absolute inset-0 bg-ink/85 text-white grid place-items-center text-center">
          <span>
            <span className="block text-[3vw] font-black">Start the board</span>
            <span className="block mt-[1vh] text-[1.4vw] opacity-80">Tap once: full screen, with the chime switched on</span>
          </span>
        </button>
      )}
    </div>
  )
}
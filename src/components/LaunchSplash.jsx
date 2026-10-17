// src/components/LaunchSplash.jsx
//
// The Print Octos mark, opening the app: the dots circle into the gold one
// and back out, the name shows, and the app is there.
//
// - Only inside the app, never on the website: a visitor to a web page
//   should not sit through an animation.
// - Only on a cold start. Coming back from another app shows the app at
//   once; the flag below lives as long as the app's JavaScript does.
// - About a second. People open this to do something.
// - Its first frame is the phone's still launch image (splash.png), so the
//   still picture and the motion read as one.
// - "Reduce motion" in the phone's settings gets a plain fade instead.

import { useEffect, useRef, useState } from 'react'

const RED = '#E31E24'
const GOLD = '#F5A623'
const GOLD_AT = 7            // top left on the ring, as in the logo
const R = 46                 // ring radius in px; matches the launch image
const DOT = R * 5 / 24
const GOLD_DOT = R * 6 / 24
const RING = R * 9 / 24
const RING_W = R * 4 / 24

let shownThisLaunch = false

const inApp = () => !!window.Capacitor?.isNativePlatform?.()
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export default function LaunchSplash({ onDone }) {
  const [skip] = useState(() => shownThisLaunch || !inApp())
  const [frame, setFrame] = useState({ r: R, spin: 0, gold: 1, ring: 1, word: 0, fade: 1 })
  const raf = useRef(0)

  useEffect(() => {
    if (skip) { onDone?.(); return undefined }
    shownThisLaunch = true

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()

    const tick = now => {
      const t = now - start
      let f
      if (still) {
        f = { r: R, spin: 0, gold: 1, ring: 1, word: 1, fade: 1 - Math.min(1, t / 250) }
      } else if (t < 150) {
        f = { r: R, spin: 0, gold: 1, ring: 1, word: 0, fade: 1 }
      } else if (t < 550) {                                   // into the gold dot
        const p = ease((t - 150) / 400)
        f = { r: R * (1 - p), spin: p * Math.PI * 1.5, gold: 1 + p * 1.4, ring: 1 - p, word: 0, fade: 1 }
      } else if (t < 850) {                                   // and back out
        const p = ease((t - 550) / 300)
        f = { r: R * p, spin: Math.PI * (1.5 + p * 0.5), gold: 2.4 - p * 1.4, ring: p, word: p, fade: 1 }
      } else {                                                // the app
        const p = Math.min(1, (t - 850) / 200)
        f = { r: R, spin: 0, gold: 1, ring: 1, word: 1, fade: 1 - p }
      }
      setFrame(f)
      if (f.fade > 0) raf.current = requestAnimationFrame(tick)
      else onDone?.()
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [skip, onDone])

  if (skip || frame.fade <= 0) return null

  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 4 + frame.spin
    const gold = i === GOLD_AT
    return (
      <circle key={i}
        cx={Math.cos(a) * frame.r} cy={Math.sin(a) * frame.r}
        r={gold ? GOLD_DOT * frame.gold : DOT}
        fill={gold ? GOLD : '#fff'}
        opacity={gold || frame.r > DOT ? 1 : 0} />
    )
  })

  return (
    <div aria-hidden="true"
         style={{ position: 'fixed', inset: 0, zIndex: 1000, background: RED,
                  opacity: frame.fade, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center' }}>
      <svg width={R * 3} height={R * 3} viewBox={`${-R * 1.5} ${-R * 1.5} ${R * 3} ${R * 3}`}>
        {dots}
        <circle r={RING} fill="none" stroke="#fff" strokeWidth={RING_W} opacity={frame.ring} />
      </svg>
      <p style={{ marginTop: 18, color: '#fff', fontSize: 22, fontWeight: 700,
                  fontStyle: 'italic', opacity: frame.word }}>
        Print Octos
      </p>
    </div>
  )
}
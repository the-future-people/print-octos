import { useRef, useState } from 'react'

/**
 * Held and dragged rather than tapped.
 *
 * A deliberate gesture for the one irreversible thing on the page. It
 * falls back to a plain button when disabled, so nothing is unreachable
 * for someone who cannot drag.
 */
export default function SwipeToPay({ label, amount, onConfirm, disabled, busy }) {
  const track = useRef(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const KNOB = 52

  function limit() {
    const width = track.current?.offsetWidth || 0
    return Math.max(0, width - KNOB - 8)
  }

  function move(clientX) {
    if (!track.current) return
    const left = track.current.getBoundingClientRect().left
    setX(Math.min(limit(), Math.max(0, clientX - left - KNOB / 2)))
  }

  function release() {
    setDragging(false)
    if (x >= limit() - 4) {
      onConfirm()
    }
    setX(0)
  }

  if (disabled) {
    return (
      <div className="w-full h-13 rounded-full bg-substrate text-body
                      flex items-center justify-center text-sm font-semibold py-3.5">
        {label}
      </div>
    )
  }

  return (
    <div
      ref={track}
      onPointerMove={e => dragging && move(e.clientX)}
      onPointerUp={release}
      onPointerLeave={() => dragging && release()}
      className="relative w-full rounded-full bg-farhat select-none touch-none
                 overflow-hidden"
      style={{ height: KNOB + 8 }}
    >
      <span className="absolute inset-0 flex items-center justify-center gap-1.5
                       pointer-events-none"
            style={{ opacity: 1 - x / (limit() || 1) }}>
        {busy ? (
          <span className="text-white text-sm font-semibold">One moment…</span>
        ) : (
          <>
            <span className="text-white text-sm font-semibold">{label}</span>
            {amount && (
              <span className="text-gold text-[1.05rem] font-extrabold tabular-nums">
                GHS {amount}
              </span>
            )}
          </>
        )}
      </span>

      <button
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
        }}
        aria-label={label}
        className="absolute top-1 left-1 rounded-full bg-white text-farhat
                   flex items-center justify-center shadow-sm cursor-grab
                   active:cursor-grabbing"
        style={{
          width: KNOB, height: KNOB,
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 180ms',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"
             aria-hidden="true">
          <path d="M5 12h13" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}
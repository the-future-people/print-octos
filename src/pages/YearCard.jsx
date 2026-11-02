// src/pages/YearCard.jsx
//
// A customer's year-end thank-you card, opened from the link in their
// text (and, once WhatsApp is connected, from its button). The code in
// the address is the key: it opens this one card and nothing else.
//
// Two cards, and only what is true for each customer. Someone who
// ordered this year sees their year: orders, favourite, first month,
// busiest month. Someone who did not sees thanks, never invented figures.

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getYearCard } from '../api/client'

const RED = '#e31e24', GOLD = '#ffd43b', AMBER = '#f5a623', CREAM = '#fdf6ea', INK = '#2a1a10', MUTED = '#5a4636'
const SERIF = "'Fraunces', Georgia, serif"

function useFraunces() {
  useEffect(() => {
    if (document.getElementById('fraunces-font')) return
    const l = document.createElement('link')
    l.id = 'fraunces-font'
    l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,800;1,9..144,700&display=swap'
    document.head.appendChild(l)
  }, [])
}

const CSS = `
@keyframes yc-rise{to{opacity:1;transform:none}}
@keyframes yc-fall{0%{transform:translateY(-12px) rotate(0)}100%{transform:translateY(260px) rotate(320deg)}}
@keyframes yc-float{50%{transform:translateY(-5px)}}
@keyframes yc-shine{0%,60%{left:-60%}100%{left:130%}}
@keyframes yc-wave{0%,100%{transform:rotate(0)}20%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}60%{transform:rotate(0)}}
.yc-rise{opacity:0;transform:translateY(10px);animation:yc-rise .6s ease-out forwards}
.yc-medal{animation:yc-float 3.2s ease-in-out infinite;overflow:hidden;position:relative}
.yc-medal::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);transform:skewX(-20deg);animation:yc-shine 3.6s ease-in-out infinite 1s}
.yc-conf{position:absolute;top:-12px;width:9px;height:4px;border-radius:1px;animation:yc-fall linear infinite;opacity:.9}
.yc-sp{display:inline-block;animation:yc-wave 2.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.yc-rise{opacity:1;transform:none;animation:none}.yc-medal,.yc-conf,.yc-sp,.yc-medal::after{animation:none}}
`

function CountUp({ to }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!to) return undefined
    let i = 0
    const start = setTimeout(() => {
      const t = setInterval(() => { i += 1; setN(i); if (i >= to) clearInterval(t) }, Math.max(40, 700 / to))
    }, 400)
    return () => clearTimeout(start)
  }, [to])
  return <>{n}</>
}

function Tile({ emoji, value, label, delay }) {
  return (
    <div className="yc-rise rounded-xl text-center px-1 pt-2.5 pb-2"
         style={{ background: '#fffaf1', border: '1px solid #f0d9a8', animationDelay: `${delay}s` }}>
      <div className="text-[18px]" aria-hidden="true">{emoji}</div>
      <div className="leading-tight" style={{ fontFamily: SERIF, fontWeight: 800, color: '#c4141a', fontSize: 20 }}>{value}</div>
      <div className="text-[11px] leading-tight" style={{ color: MUTED }}>{label}</div>
    </div>
  )
}

export default function YearCard() {
  useFraunces()
  const { code } = useParams()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    getYearCard(code).then(r => setCard(r.data)).catch(() => setMissing(true))
  }, [code])

  if (missing) return (
    <div className="min-h-screen grid place-items-center px-6 text-center" style={{ background: CREAM, color: INK }}>
      <p>This card couldn't be found. Check the link in your message.</p>
    </div>
  )
  if (!card) return <div className="min-h-screen" style={{ background: CREAM }} />

  const s = card.stats || {}
  const ordered = card.kind === 'ORDERED'
  const name = card.first_name
  const confetti = Array.from({ length: 16 }, (_, i) => ({
    left: (i * 6.3 + 3) % 100, dur: 5 + ((i * 37) % 5), delay: -((i * 13) % 7),
    color: [GOLD, AMBER, '#ffffff', '#ffe066'][i % 4], rot: (i * 47) % 360,
  }))

  return (
    <div className="min-h-screen flex justify-center pb-24" style={{ background: CREAM, color: INK }}>
      <style>{CSS}</style>
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden text-center text-white px-5 pt-7 pb-14"
             style={{ background: `radial-gradient(circle at 50% 10%, #e8252b, #d4141b 55%, #b10e14)` }}>
          {confetti.map((c, i) => (
            <span key={i} className="yc-conf" aria-hidden="true"
                  style={{ left: `${c.left}%`, background: c.color, animationDuration: `${c.dur}s`,
                           animationDelay: `${c.delay}s`, transform: `rotate(${c.rot}deg)` }} />
          ))}
          <div className="relative text-[11px] font-bold tracking-[2.4px]">FARHAT <span style={{ color: GOLD }}>PRINTING PRESS</span></div>
          <div className="relative mt-3 flex items-center justify-center gap-2" style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, color: GOLD, fontSize: 18 }}>
            <span className="w-7 h-px bg-white/80" />{ordered ? `Your ${card.year} with us` : "Season's greetings"}<span className="w-7 h-px bg-white/80" />
          </div>
          <div className="relative mt-2 leading-none" style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 40 }}>Thank you{name ? ',' : '!'}</div>
          {name && <div className="relative leading-tight" style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 46, color: GOLD }}>{name}!</div>}
          <div className="relative mt-2 text-[15px]">
            {ordered ? 'You made this year special for us.' : 'For being part of the Farhat family.'}
          </div>
        </div>

        <svg viewBox="0 0 300 30" preserveAspectRatio="none" className="block w-full h-[30px] -mt-[30px] relative" aria-hidden="true">
          <path d="M0 16 C70 2 110 26 150 20 C200 12 240 2 300 6 L300 30 L0 30Z" fill={CREAM} />
          <path d="M0 16 C70 2 110 26 150 20 C200 12 240 2 300 6" fill="none" stroke="#f2b51b" strokeWidth="4" />
        </svg>
        <div className="yc-medal w-[74px] h-[74px] rounded-full mx-auto -mt-11 grid place-items-center text-[34px] relative z-10"
             style={{ background: `radial-gradient(circle at 35% 30%, #ffe680, ${GOLD} 50%, #f0a81c)`, border: `4px solid ${CREAM}`,
                      boxShadow: '0 6px 16px rgba(180,20,26,.25)' }} aria-hidden="true">
          {ordered ? '🏆' : '🎁'}
        </div>

        <div className="px-5 pt-3">
          {ordered ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Tile emoji="📋" value={<CountUp to={s.orders} />} label={s.orders === 1 ? 'order' : 'orders'} delay={0.3} />
                {s.favourite && <Tile emoji="🖼️" value={s.favourite} label="your favourite" delay={0.4} />}
                {s.first_month && <Tile emoji="📅" value={s.first_month} label="your first order" delay={0.5} />}
              </div>
              {s.biggest_month && (
                <div className="yc-rise mt-3 rounded-xl px-3 py-2.5 flex gap-3 items-center text-[13px] leading-snug"
                     style={{ border: '1.5px solid #f2c94c', background: '#fffaf1', animationDelay: '.7s' }}>
                  <span className="text-[26px]" aria-hidden="true">🏅</span>
                  <span>Your biggest month was <b style={{ color: '#c4141a' }}>{s.biggest_month}</b>, with <b style={{ color: '#c4141a' }}>{s.biggest_count} orders</b>. We loved every one.</span>
                </div>
              )}
              <p className="yc-rise mt-4 text-center text-[14px] leading-relaxed" style={{ animationDelay: '.9s' }}>
                Every order you trusted us with kept our presses running and our team smiling.
                <b className="block mt-1 text-[15.5px]" style={{ color: '#c4141a' }}>Thank you for choosing Farhat. 🙏</b>
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Tile emoji="📅" value="" label="Another year together" delay={0.3} />
                <Tile emoji="🤝" value="" label="Your trust and support" delay={0.4} />
                <Tile emoji="❤️" value="" label="It means a lot" delay={0.5} />
              </div>
              <div className="yc-rise mt-3 rounded-xl px-3 py-2.5 flex gap-3 items-center text-[13px] leading-snug"
                   style={{ border: '1.5px solid #f2c94c', background: '#fffaf1', animationDelay: '.7s' }}>
                <span className="text-[24px]" aria-hidden="true">✨</span>
                <span><b>Whether you printed with us this year or many years ago,</b> you're part of our story, and we're grateful.</span>
              </div>
              <div className="yc-rise mt-2.5 rounded-xl px-3 py-2.5 flex gap-3 items-center text-[13px] leading-snug"
                   style={{ border: '1px solid #f0d9a8', background: '#fffaf1', animationDelay: '.8s' }}>
                <span className="text-[24px]" aria-hidden="true">🖨️</span>
                <span><b>Banners, cards, flyers, stickers and more,</b> ready when you are. You can now order from your phone, too.</span>
              </div>
              <p className="yc-rise mt-4 text-center text-[14px] leading-relaxed" style={{ animationDelay: '.9s' }}>
                <b className="block text-[15.5px]" style={{ color: '#c4141a' }}>Thank you for choosing Farhat.</b>
                We'd love to see you again soon. 🙏
              </p>
            </>
          )}

          <div className="yc-rise mt-4 mx-4 rounded-full text-center py-1.5" style={{ background: '#fbe0dc', animationDelay: '1.1s' }}>
            <span style={{ fontFamily: SERIF, fontWeight: 800, color: '#a8121a', fontSize: 30 }}>
              <span className="yc-sp text-[18px] mr-2" style={{ color: '#f2b51b' }}>✨</span>Afehyia pa!<span className="yc-sp text-[18px] ml-2" style={{ color: '#f2b51b' }}>✨</span>
            </span>
          </div>
          <p className="yc-rise mt-2 text-center text-[13.5px] leading-relaxed" style={{ animationDelay: '1.2s' }}>
            Wishing you and your family a joyful season and a blessed {card.next_year}.
          </p>

          <button onClick={() => navigate('/')}
                  className="yc-rise mt-5 w-full rounded-2xl py-3.5 text-white text-[15px] font-bold"
                  style={{ background: '#1f1f1f', animationDelay: '1.4s' }}>
            {ordered ? 'Order again' : "See what's new"} ›
          </button>

          <div className="yc-rise mt-5 text-center text-[12px]" style={{ color: MUTED, animationDelay: '1.5s' }}>
            <div className="flex items-center gap-2 mx-6 mb-1.5" aria-hidden="true">
              <span className="flex-1 h-px" style={{ background: '#e3cfaa' }} /><span style={{ color: RED }}>❤</span><span className="flex-1 h-px" style={{ background: '#e3cfaa' }} />
            </div>
            With love, the {card.business} family
          </div>
        </div>
      </div>
    </div>
  )
}

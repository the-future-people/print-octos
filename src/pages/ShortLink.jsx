import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { openShortLink } from '../api/client'
import Header from '../components/Header.jsx'

/**
 * The link we text, exchanged for the real one.
 *
 * A tracking URL carrying the access token runs past ninety
 * characters and leaves no room for a message around it. So the text
 * carries eight characters instead, and this trades them for the
 * token and sends the customer on.
 *
 * Invisible when it works, which is most of the time.
 */
export default function ShortLink() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true

    openShortLink(code)
      .then(({ data }) => {
        if (!live) return
        navigate(
          `/track/${data.order_number}?t=${data.token}`,
          { replace: true },
        )
      })
      .catch(() => live && setFailed(true))

    return () => { live = false }
  }, [code, navigate])

  return (
    <div className="min-h-screen bg-white text-ink">
      <Header />
      <main className="max-w-md mx-auto px-5">
        {failed ? (
          <div className="py-16 text-center">
            <p className="text-base font-semibold">
              That link doesn’t open anything
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-body">
              It may have expired, or been typed slightly differently.
              Call us on{' '}
              <a href="tel:0300000000" className="font-semibold text-farhat">
                030 000 0000
              </a>{' '}
              with your order number and we’ll look it up.
            </p>
            <button
              onClick={() => navigate('/track')}
              className="mt-5 px-5 py-2.5 rounded-lg border border-ink text-sm
                         font-semibold hover:bg-ink hover:text-white
                         transition-colors"
            >
              Find my order another way
            </button>
          </div>
        ) : (
          <p className="py-20 text-center text-sm text-body">
            Opening your order…
          </p>
        )}
      </main>
    </div>
  )
}
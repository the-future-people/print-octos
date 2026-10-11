import { useNavigate } from 'react-router-dom'
import { useCart } from '../lib/CartContext.jsx'
import logo from '../assets/farhat-logo.png'

/**
 * The same header on every page.
 *
 * Three pages had grown three headers that differed in small ways
 * nobody chose — a cart on one, a text link on another, a different
 * logo size on the third. One component means a change lands
 * everywhere, and a customer moving between pages sees one shop.
 *
 * Its width matches the content beneath it, so the mark sits on the
 * same line as the headline below and the cart on the same line as the
 * right edge of the grid. A header on a wider measure than its page
 * reads as a separate thing bolted on top.
 *
 * What varies is only what should: the back arrow appears where there
 * is somewhere to go back to, and the tracking page shows its order
 * number instead of the cart, because there the cart is not the
 * subject and the reference is what someone reads out on the phone.
 */
export default function Header({ back = false, orderNumber = null }) {
  const navigate = useNavigate()
  const cart = useCart()

  return (
    <header className="bg-farhat">
      <div className="bg-black/10">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">

          {back && (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="shrink-0 -ml-1 text-white/90 hover:text-white transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="w-5 h-5">
                <path d="M19 12H5" />
                <path d="M11 18l-6-6 6-6" />
              </svg>
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 min-w-0"
          >
            <img src={logo} alt="" className="h-11 sm:h-12 w-auto shrink-0"
                 aria-hidden="true" />
            {/* Stacked, so the mark reads as one block rather than a
                line of text running away from the bird. */}
            <span className="text-left leading-none">
              <span className="block text-[1.15rem] sm:text-[1.3rem] font-bold
                               text-white tracking-tight">
                Farhat
              </span>
              <span className="block mt-0.5 text-[0.6rem] sm:text-[0.68rem]
                               font-medium text-white/80 tracking-[0.13em]
                               uppercase">
                Printing Press
              </span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-4 sm:gap-5 shrink-0 -mr-0.5">

            {orderNumber ? (
              <span className="text-[0.7rem] sm:text-xs text-white/80
                               tracking-wide tabular-nums">
                {orderNumber}
              </span>
            ) : (
              <>
                <button
                  onClick={() => navigate('/track')}
                  aria-label="Track an order"
                  className="text-white/90 hover:text-white transition-colors"
                >
                  {/* Words on a wide screen, a parcel on a phone: both
                      are destinations rather than actions, so an icon
                      reads as well and leaves the cart room. */}
                  <span className="hidden sm:inline text-xs">Track an order</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                       className="w-[19px] h-[19px] sm:hidden" aria-hidden="true">
                    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                    <path d="M4 7.5l8 4.5 8-4.5" />
                    <path d="M12 12v9" />
                  </svg>
                </button>

                <button
                  onClick={() => navigate('/checkout')}
                  aria-label={
                    cart.count
                      ? `Your order, ${cart.count} item${cart.count === 1 ? '' : 's'}`
                      : 'Your order is empty'
                  }
                  className="relative text-white/90 hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
                       className="w-[21px] h-[21px]" aria-hidden="true">
                    <circle cx="9" cy="20" r="1.4" />
                    <circle cx="18" cy="20" r="1.4" />
                    <path d="M2 3h2.5l2.3 11.5a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" />
                  </svg>

                  {/* No badge rather than a zero. A nought draws the eye
                      to nothing. */}
                  {cart.count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1
                                     rounded-full bg-white text-farhat text-[0.62rem]
                                     font-extrabold leading-4 text-center tabular-nums">
                      {cart.count}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
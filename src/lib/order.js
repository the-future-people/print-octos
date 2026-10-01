/**
 * The order the customer is building, kept in the browser.
 *
 * The token is what opens an order — the number is sequential and
 * guessable — so losing it means losing the order. A refresh or a
 * backgrounded tab must not do that.
 */
const KEY = 'print-octos:order'

export function saveOrder({ order_number, access_token }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ order_number, access_token }))
  } catch {
    // A browser with storage disabled still works for one sitting.
  }
}

export function loadOrder() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearOrder() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}
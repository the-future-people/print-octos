import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getOrder } from '../api/client'
import { loadOrder, saveOrder, clearOrder } from './order'

/**
 * The cart, in one place.
 *
 * Before this, each page read the order when it mounted and never
 * again — which is why the count needed a refresh to change. A page
 * that adds an item and a header that shows the count are different
 * parts of the screen, and they have to be looking at the same thing.
 *
 * The server is the authority. This holds a copy so the screen can
 * react immediately, and every change comes back from a response
 * rather than being guessed at locally.
 *
 * An order that cannot be loaded — expired, swept, or from before some
 * change — is quietly forgotten. There is nothing in it worth keeping
 * and nothing worth telling the customer about.
 */

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const queryClient = useQueryClient()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  // What is saved in this browser: the order number and its token. The
  // number alone proves nothing — it is sequential, so the token is
  // what makes an order yours.
  const [saved, setSaved] = useState(() => loadOrder())

  const refresh = useCallback(async () => {
    if (!saved) {
      setOrder(null)
      setLoading(false)
      return null
    }

    try {
      const { data } = await getOrder(saved.order_number, saved.access_token)

      // A paid order is no longer a cart. The next thing the customer
      // orders starts a new one rather than joining something that has
      // already gone to the floor.
      if (data.is_paid) {
        clearOrder()
        setSaved(null)
        setOrder(null)
        return null
      }

      setOrder(data)
      return data
    } catch {
      // Gone, expired, or unreadable. Forgotten quietly — there is
      // nothing in it to lose and an error here would be about our
      // housekeeping rather than anything the customer did.
      clearOrder()
      setSaved(null)
      setOrder(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [saved])

  useEffect(() => { refresh() }, [refresh])

  /**
   * After a commit. The server has just told us what the order now
   * holds, so the screen can show it without asking again.
   */
  const adopt = useCallback(result => {
    const reference = {
      order_number: result.order_number,
      access_token: result.access_token,
    }
    saveOrder(reference)
    setSaved(reference)
    setOrder(current => ({
      ...(current || {}),
      order_number: result.order_number,
      total: result.total,
      line_items: Array.from({ length: result.line_count }),
    }))

    // Any page holding a cached copy of this order is now wrong. The
    // context and a page's own query are two views of one thing, and
    // only this makes them agree — without it the customer adds an
    // item and the cart shows what it held a moment ago.
    queryClient.invalidateQueries({ queryKey: ['order'] })
    queryClient.invalidateQueries({ queryKey: ['order-file'] })
  }, [queryClient])

  /**
   * Done with this cart — it has been paid for, or the customer asked
   * to start again.
   */
  const forget = useCallback(() => {
    clearOrder()
    setSaved(null)
    setOrder(null)
  }, [])

  const value = {
    order,
    saved,
    loading,
    count: order?.line_items?.length ?? 0,
    total: order?.total ?? null,
    refresh,
    adopt,
    forget,
  }

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  )
}

export function useCart() {
  const value = useContext(CartContext)
  if (!value) {
    throw new Error('useCart must be used inside a CartProvider')
  }
  return value
}
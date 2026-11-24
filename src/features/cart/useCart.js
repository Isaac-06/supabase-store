import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../shared/services/supabase.js'

export const savedCartKey = 'neoncart-items'
export const guestCartKey = 'neoncart-guest-items'

export function asNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeCartItem(item) {
  if (!item || typeof item !== 'object') return null

  const quantity = Math.max(0, Math.trunc(asNumber(item.quantity, 1)))

  return {
    ...item,
    quantity: quantity || 0,
    price: asNumber(item.price, 0),
  }
}

export function getSavedCartItems(userId) {
  if (!userId) return []

  try {
    const savedItems = window.localStorage.getItem(savedCartKey)
    const parsedCart = savedItems ? JSON.parse(savedItems) : null
    if (parsedCart?.userId !== userId || !Array.isArray(parsedCart.items)) return []
    return parsedCart.items.map(normalizeCartItem).filter(Boolean)
  } catch (error) {
    console.error('Could not restore cart:', error)
    return []
  }
}

export function getSavedGuestCartItems() {
  try {
    const savedCart = window.localStorage.getItem(guestCartKey)
    const parsedCart = savedCart ? JSON.parse(savedCart) : null
    if (!Array.isArray(parsedCart?.items)) return []
    return parsedCart.items.map(normalizeCartItem).filter(Boolean)
  } catch (error) {
    console.error('Could not restore guest cart:', error)
    return []
  }
}

export function mergeCartItems(savedItems, guestItems) {
  const mergedItems = savedItems.map(normalizeCartItem).filter(Boolean)

  guestItems.forEach((guestItem) => {
    const guestKey = String(guestItem.id ?? guestItem.product_id)
    const savedIndex = mergedItems.findIndex(
      (savedItem) => String(savedItem.id ?? savedItem.product_id) === guestKey
    )

    if (savedIndex === -1) {
      mergedItems.push(guestItem)
      return
    }

    const savedItem = mergedItems[savedIndex]
    mergedItems[savedIndex] = {
      ...savedItem,
      ...guestItem,
      quantity: savedItem.quantity + guestItem.quantity,
      customizationNotes: guestItem.customizationNotes || savedItem.customizationNotes || '',
    }
  })

  return mergedItems
}

async function loadCartFromSupabase(userId) {
  if (!userId || !isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.product_id,
      product_id: row.product_id,
      name: row.product_name,
      price: asNumber(row.price, 0),
      image: row.image || '',
      quantity: Math.max(1, Math.trunc(asNumber(row.quantity, 1))),
      customizationNotes: typeof row.customization_notes === 'string' ? row.customization_notes : '',
    }))
  } catch (error) {
    console.error('Could not load cart from Supabase:', error)
    return []
  }
}

async function saveCartToSupabase(userId, items) {
  if (!userId || !isSupabaseConfigured) return false

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser || authUser.id !== userId) {
      console.warn('Skipping cart sync: auth session not ready')
      return false
    }

    const normalizedItems = items
      .map((item) => {
        const normalized = normalizeCartItem(item)
        if (!normalized || !normalized.id) return null

        return {
          user_id: userId,
          product_id: Number(normalized.id),
          product_name: String(normalized.name || 'Product'),
          price: Number(normalized.price || 0),
          image: typeof normalized.image === 'string' ? normalized.image : '',
          quantity: Math.max(1, Math.trunc(asNumber(normalized.quantity, 1))),
          customization_notes: typeof normalized.customizationNotes === 'string'
            ? normalized.customizationNotes
            : '',
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (normalizedItems.length === 0) {
      const { error } = await supabase.from('cart_items').delete().eq('user_id', userId)
      if (error) throw error
      return true
    }

    const { error: upsertError } = await supabase
      .from('cart_items')
      .upsert(normalizedItems, { onConflict: 'user_id,product_id' })
    if (upsertError) throw upsertError

    const { data: existingRows, error: fetchError } = await supabase
      .from('cart_items')
      .select('product_id')
      .eq('user_id', userId)
    if (fetchError) throw fetchError

    const productIds = normalizedItems.map((item) => item.product_id)
    const staleIds = (existingRows ?? [])
      .map((row) => Number(row.product_id))
      .filter((productId) => !productIds.includes(productId))

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .in('product_id', staleIds)
      if (deleteError) throw deleteError
    }

    return true
  } catch (error) {
    console.error('Could not sync cart with Supabase:', error)
    return false
  }
}

export function useCart(user, authInitialized) {
  const [cartItems, setCartItems] = useState([])
  const [cartReadyForUserId, setCartReadyForUserId] = useState(undefined)
  const previousUserId = useRef(null)
  const transitionId = useRef(0)
  const restoredUserId = useRef(null)
  const currentUserId = user?.id ?? null
  const cartReady = cartReadyForUserId === currentUserId

  useEffect(() => {
    if (!authInitialized) return

    const nextTransitionId = transitionId.current + 1
    transitionId.current = nextTransitionId

    const nextUserId = currentUserId
    restoredUserId.current = nextUserId
    if (!nextUserId) {
      previousUserId.current = null
      const guestItems = getSavedGuestCartItems()
      Promise.resolve().then(() => {
        if (transitionId.current !== nextTransitionId) return
        setCartItems(guestItems)
        setCartReadyForUserId(null)
      })
      return
    }

    void loadCartFromSupabase(nextUserId).then((restoredCart) => {
      if (transitionId.current !== nextTransitionId) return
      const accountCart = restoredCart.length > 0
        ? restoredCart
        : getSavedCartItems(nextUserId)
      const guestCart = previousUserId.current ? [] : getSavedGuestCartItems()
      setCartItems(mergeCartItems(accountCart, guestCart))
      setCartReadyForUserId(nextUserId)
      previousUserId.current = nextUserId
    })
  }, [authInitialized, currentUserId])

  useEffect(() => {
    if (!authInitialized || !cartReady) return

    try {
      if (!user) {
        window.localStorage.setItem(guestCartKey, JSON.stringify({ items: cartItems }))
        return
      }

      window.localStorage.setItem(savedCartKey, JSON.stringify({
        userId: user.id,
        items: cartItems,
      }))
      window.localStorage.removeItem(guestCartKey)
      if (restoredUserId.current !== user.id) return
      void saveCartToSupabase(user.id, cartItems)
    } catch (error) {
      console.error('Could not save cart:', error)
    }
  }, [authInitialized, cartItems, cartReady, user])

  const addToCart = useCallback((product, customizationNotes = '') => {
    setCartItems((currentItems) => {
      const normalizedProduct = normalizeCartItem(product)
      const existingItem = currentItems.find((item) => item.id === product.id)

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === product.id
            ? {
                ...normalizeCartItem(item),
                quantity: asNumber(item.quantity, 1) + 1,
                customizationNotes: customizationNotes || item.customizationNotes || '',
              }
            : item
        )
      }

      return [...currentItems, normalizedProduct
        ? { ...normalizedProduct, quantity: 1, customizationNotes }
        : { ...product, quantity: 1, customizationNotes }]
    })
  }, [])

  const removeFromCart = useCallback((id) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.id !== id))
  }, [])

  const updateQuantity = useCallback((id, nextQuantity) => {
    setCartItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.id !== id) return [item]

        const quantity = Math.max(0, Math.trunc(asNumber(nextQuantity, 0)))
        return quantity === 0 ? [] : [{ ...normalizeCartItem(item), quantity }]
      })
    )
  }, [])

  const clearCart = useCallback(() => setCartItems([]), [])
  const totalItems = cartItems.reduce(
    (sum, item) => sum + Math.max(0, Math.trunc(asNumber(item.quantity, 0))),
    0
  )

  return {
    cartItems,
    cartReady,
    totalItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  }
}

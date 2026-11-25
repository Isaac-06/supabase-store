import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../shared/services/supabase.js'

function getPaymentReference() {
  const callbackUrl = new URL(window.location.href)
  if (callbackUrl.searchParams.get('payment') !== 'paystack') return null
  return callbackUrl.searchParams.get('reference') || callbackUrl.searchParams.get('trxref') || ''
}

async function getFunctionErrorDetails(error, fallback) {
  let message = error instanceof Error ? error.message : fallback
  let status
  const response = error && typeof error === 'object' && 'context' in error
    ? error.context
    : null

  if (response instanceof Response) {
    status = response.status
    try {
      const body = await response.clone().json()
      if (typeof body?.error === 'string') message = body.error
    } catch (responseError) {
      console.error('Could not read the payment function error response:', responseError)
    }
  }

  return { message, status }
}

export function useCheckout({ user, cartItems, cartReady, clearCart, setCurrentView, enabled }) {
  const userId = user?.id
  const [paymentReference, setPaymentReference] = useState(getPaymentReference)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedOrder, setCompletedOrder] = useState(null)
  const [deliveryProfileState, setDeliveryProfileState] = useState(null)
  const [deliveryProfileErrorState, setDeliveryProfileErrorState] = useState(null)
  const [quoteState, setQuoteState] = useState({
    cartKey: null,
    status: 'idle',
    quote: null,
    error: '',
  })
  const verificationId = useRef(0)
  const quoteRequestId = useRef(0)
  const cartKey = JSON.stringify(cartItems.map((item) => ({
    product_id: item.id ?? item.product_id,
    quantity: item.quantity,
    customization_notes: item.customizationNotes || '',
  })))

  const clearError = useCallback(() => setError(''), [])

  useEffect(() => {
    if (!enabled || !userId) return undefined

    let isActive = true

    async function loadDeliveryProfile() {
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('phone, address_line_1, address_line_2, city, postal_code, country')
          .eq('user_id', userId)
          .maybeSingle()

        if (profileError) throw profileError
        if (isActive) {
          setDeliveryProfileState({ userId, data })
          setDeliveryProfileErrorState(null)
        }
      } catch (caughtError) {
        console.error('Could not load saved delivery details:', caughtError)
        if (isActive) {
          setDeliveryProfileErrorState({
            userId,
            message: caughtError instanceof Error
              ? caughtError.message
              : 'Could not load saved delivery details.',
          })
        }
      }
    }

    void loadDeliveryProfile()

    return () => {
      isActive = false
    }
  }, [enabled, userId])

  const deliveryProfile = enabled && userId && deliveryProfileState?.userId === userId
    ? deliveryProfileState.data
    : null
  const deliveryProfileError = enabled && userId && deliveryProfileErrorState?.userId === userId
    ? deliveryProfileErrorState.message
    : ''
  const deliveryProfileReady = Boolean(enabled && userId && (
    deliveryProfileState?.userId === userId
    || deliveryProfileErrorState?.userId === userId
  ))

  const refreshQuote = useCallback(async () => {
    if (!userId || cartItems.length === 0) return

    const requestId = quoteRequestId.current + 1
    quoteRequestId.current = requestId
    setQuoteState({ cartKey, status: 'loading', quote: null, error: '' })

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('paystack-payments', {
        body: {
          action: 'quote',
          items: cartItems.map((item) => ({
            product_id: item.id ?? item.product_id,
            quantity: item.quantity,
            customization_notes: item.customizationNotes || '',
          })),
        },
      })

      if (invokeError) throw invokeError
      if (!data || !Array.isArray(data.items) || typeof data.total_amount !== 'number') {
        throw new Error('The checkout quote response was invalid.')
      }

      if (quoteRequestId.current === requestId) {
        setQuoteState({ cartKey, status: 'ready', quote: data, error: '' })
      }
    } catch (caughtError) {
      console.error('Could not refresh checkout prices:', caughtError)
      const { message } = await getFunctionErrorDetails(
        caughtError,
        'Could not refresh current prices. Please try again.'
      )
      if (quoteRequestId.current === requestId) {
        setQuoteState({ cartKey, status: 'error', quote: null, error: message })
      }
    }
  }, [cartItems, cartKey, userId])

  useEffect(() => {
    if (!enabled || !cartReady || !cartItems.length) return undefined

    const timeoutId = window.setTimeout(() => {
      void refreshQuote()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
      quoteRequestId.current += 1
    }
  }, [cartItems.length, cartReady, enabled, refreshQuote])

  const currentQuote = quoteState.cartKey === cartKey && quoteState.status === 'ready'
    ? quoteState.quote
    : null
  const quoteError = quoteState.cartKey === cartKey && quoteState.status === 'error'
    ? quoteState.error
    : ''
  const isQuoting = quoteState.cartKey === cartKey && quoteState.status === 'loading'
  const quoteReady = cartItems.length === 0 || currentQuote !== null
  const quoteItems = currentQuote?.items ?? []
  const priceChanged = currentQuote?.items.some((quotedItem) => {
    const cartItem = cartItems.find(
      (item) => String(item.id ?? item.product_id) === String(quotedItem.product_id)
    )
    return cartItem && Math.round(Number(cartItem.price) * 100) !== Math.round(quotedItem.price * 100)
  }) ?? false

  const placeOrder = useCallback(async (deliveryDetails) => {
    if (!userId || cartItems.length === 0 || isSubmitting || !currentQuote) return

    setError('')
    setIsSubmitting(true)

    const deliveryAddress = {
      phone: deliveryDetails.phone.trim(),
      address_line_1: deliveryDetails.addressLine1.trim(),
      address_line_2: deliveryDetails.addressLine2.trim(),
      city: deliveryDetails.city.trim(),
      postal_code: deliveryDetails.postalCode.trim(),
    }

    try {
      const { error: profileSaveError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          phone: deliveryAddress.phone,
          address_line_1: deliveryAddress.address_line_1,
          address_line_2: deliveryAddress.address_line_2,
          city: deliveryAddress.city,
          postal_code: deliveryAddress.postal_code,
          country: deliveryProfile?.country || 'Nigeria',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (profileSaveError) {
        throw new Error(`Could not save your delivery details: ${profileSaveError.message}`)
      }

      const { data, error: invokeError } = await supabase.functions.invoke('paystack-payments', {
        body: {
          action: 'initialize',
          items: cartItems.map((item) => ({
            product_id: item.id ?? item.product_id,
            quantity: item.quantity,
            customization_notes: item.customizationNotes || '',
          })),
          expected_items: currentQuote.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })),
          delivery_address: deliveryAddress,
        },
      })

      if (invokeError) throw invokeError
      if (!data?.authorization_url) throw new Error('Paystack did not return a payment link.')
      window.location.assign(data.authorization_url)
    } catch (caughtError) {
      console.error('Could not prepare checkout or start Paystack payment:', caughtError)
      const { message, status } = await getFunctionErrorDetails(
        caughtError,
        'Could not start payment. Please try again.'
      )
      setError(message)
      if (status === 409) await refreshQuote()
    } finally {
      setIsSubmitting(false)
    }
  }, [cartItems, currentQuote, deliveryProfile, isSubmitting, refreshQuote, userId])

  useEffect(() => {
    if (paymentReference === null || !userId) return undefined

    const currentVerificationId = verificationId.current + 1
    verificationId.current = currentVerificationId
    setCurrentView('payment')

    async function verifyPayment() {
      try {
        if (!paymentReference) throw new Error('Paystack did not return a payment reference. Please try again.')

        const { data, error: invokeError } = await supabase.functions.invoke('paystack-payments', {
          body: { action: 'verify', reference: paymentReference },
        })
        if (invokeError) throw invokeError
        if (!data?.paid) throw new Error(data?.message || 'Payment could not be confirmed.')

        if (verificationId.current === currentVerificationId) {
          setCompletedOrder(data.order)
          clearCart()
          setCurrentView('confirmation')
        }
      } catch (caughtError) {
        console.error('Could not verify Paystack payment:', caughtError)
        if (verificationId.current === currentVerificationId) {
          setError(caughtError.message || 'Could not verify payment. Please try again.')
          setCurrentView('checkout')
        }
      } finally {
        if (verificationId.current === currentVerificationId) {
          const callbackUrl = new URL(window.location.href)
          callbackUrl.searchParams.delete('payment')
          callbackUrl.searchParams.delete('reference')
          callbackUrl.searchParams.delete('trxref')
          window.history.replaceState({}, '', callbackUrl)
          setPaymentReference(null)
        }
      }
    }

    void verifyPayment()
  }, [clearCart, paymentReference, setCurrentView, userId])

  return {
    paymentReference,
    isSubmitting,
    error,
    completedOrder,
    deliveryProfile,
    deliveryProfileError,
    deliveryProfileReady,
    quoteItems,
    quoteTotal: currentQuote?.total_amount ?? 0,
    quoteError,
    isQuoting,
    quoteReady,
    priceChanged,
    clearError,
    refreshQuote,
    placeOrder,
  }
}

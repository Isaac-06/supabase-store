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
      console.error('Could not start Paystack payment:', caughtError)
      const { message, status } = await getFunctionErrorDetails(
        caughtError,
        'Could not start payment. Please try again.'
      )
      setError(message)
      if (status === 409) await refreshQuote()
    } finally {
      setIsSubmitting(false)
    }
  }, [cartItems, currentQuote, isSubmitting, refreshQuote, userId])

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

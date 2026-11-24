import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../../shared/utils/currency'

function Checkout({
  items = [],
  email,
  onBack,
  onPlaceOrder,
  isSubmitting,
  error,
  quoteError,
  quoteTotal = 0,
  isQuoting,
  quoteReady,
  priceChanged,
  onRefreshQuote,
}) {
  const [isPaymentConfirmationOpen, setIsPaymentConfirmationOpen] = useState(false)
  const [pendingOrderDetails, setPendingOrderDetails] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const paymentConfirmationDialogRef = useRef(null)
  useEffect(() => {
    const dialog = paymentConfirmationDialogRef.current
    if (!dialog) return

    if (isPaymentConfirmationOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isPaymentConfirmationOpen && dialog.open) {
      dialog.close()
    }
  }, [isPaymentConfirmationOpen])

  function handleSubmit(event) {
    event.preventDefault()
    if (!quoteReady) return

    const formData = new FormData(event.currentTarget)
    const orderDetails = Object.fromEntries(formData.entries())
    const errors = {}
    const requiredFields = {
      phone: 'Enter your phone number.',
      addressLine1: 'Enter your address.',
      city: 'Enter your city.',
      postalCode: 'Enter your postal code.',
    }

    Object.entries(requiredFields).forEach(([field, message]) => {
      if (!orderDetails[field]?.trim()) errors[field] = message
    })

    if (orderDetails.phone?.trim()) {
      const enteredPhone = orderDetails.phone.trim()
      const phoneDigits = enteredPhone.replace(/\D/g, '')
      const digitsWithoutCountryCode = phoneDigits.startsWith('234')
        ? phoneDigits.slice(3)
        : phoneDigits
      const nationalPhoneDigits = digitsWithoutCountryCode.startsWith('0')
        ? digitsWithoutCountryCode.slice(1)
        : digitsWithoutCountryCode

      if (!/^[+()\d\s.-]+$/.test(enteredPhone) || nationalPhoneDigits.length < 7 || nationalPhoneDigits.length > 15) {
        errors.phone = 'Enter a phone number with 7 to 15 digits.'
      } else {
        orderDetails.phone = `+234${nationalPhoneDigits}`
      }
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setPendingOrderDetails(orderDetails)
    setIsPaymentConfirmationOpen(true)
  }

  function clearFieldError(field) {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors
      const nextErrors = { ...currentErrors }
      delete nextErrors[field]
      return nextErrors
    })
  }

  function handleConfirmPayment() {
    if (!pendingOrderDetails || !quoteReady) return
    onPlaceOrder(pendingOrderDetails)
    setPendingOrderDetails(null)
    setIsPaymentConfirmationOpen(false)
  }

  return (
    <section className="checkout-page">
      <button type="button" className="back-arrow-button" aria-label="Back to cart" title="Back to cart" onClick={onBack}>
        <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span>
      </button>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit} noValidate>
          <p className="eyebrow">Checkout</p>
          <h1>Delivery details</h1>
          <p className="checkout-account">Signed in as <strong>{email}</strong></p>

          <div className="checkout-fields">
            <label>
              Phone number
              <span className="checkout-phone-input">
                <span className="checkout-phone-prefix">+234</span>
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel-national"
                  placeholder="8012345678"
                  maxLength="40"
                  required
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'checkout-phone-error' : undefined}
                  onChange={() => clearFieldError('phone')}
                />
              </span>
              {fieldErrors.phone && <span className="checkout-field-error" id="checkout-phone-error">{fieldErrors.phone}</span>}
            </label>
            <label className="checkout-field-full">
              Address
              <input
                name="addressLine1"
                type="text"
                autoComplete="address-line1"
                maxLength="200"
                required
                aria-invalid={Boolean(fieldErrors.addressLine1)}
                aria-describedby={fieldErrors.addressLine1 ? 'checkout-address-error' : undefined}
                onChange={() => clearFieldError('addressLine1')}
              />
              {fieldErrors.addressLine1 && <span className="checkout-field-error" id="checkout-address-error">{fieldErrors.addressLine1}</span>}
            </label>
            <label className="checkout-field-full">
              Apartment, suite, etc. (optional)
              <input name="addressLine2" type="text" autoComplete="address-line2" maxLength="200" />
            </label>
            <label>
              City
              <input
                name="city"
                type="text"
                autoComplete="address-level2"
                maxLength="100"
                required
                aria-invalid={Boolean(fieldErrors.city)}
                aria-describedby={fieldErrors.city ? 'checkout-city-error' : undefined}
                onChange={() => clearFieldError('city')}
              />
              {fieldErrors.city && <span className="checkout-field-error" id="checkout-city-error">{fieldErrors.city}</span>}
            </label>
            <label>
              Postal code
              <input
                name="postalCode"
                type="text"
                autoComplete="postal-code"
                maxLength="24"
                required
                aria-invalid={Boolean(fieldErrors.postalCode)}
                aria-describedby={fieldErrors.postalCode ? 'checkout-postal-code-error' : undefined}
                onChange={() => clearFieldError('postalCode')}
              />
              {fieldErrors.postalCode && <span className="checkout-field-error" id="checkout-postal-code-error">{fieldErrors.postalCode}</span>}
            </label>
          </div>

          {error && <p className="checkout-error" role="alert">{error}</p>}
          {quoteError && (
            <div className="checkout-error" role="alert">
              <p>{quoteError}</p>
              <button type="button" className="secondary-btn" onClick={onRefreshQuote} disabled={isQuoting}>
                {isQuoting ? 'Refreshing prices...' : 'Refresh prices'}
              </button>
            </div>
          )}
          {priceChanged && !quoteError && (
            <p className="checkout-price-notice" role="status">
              Product prices have changed since they were added to your cart. Review the updated total before continuing.
            </p>
          )}
          {isQuoting && <p className="product-status" role="status">Checking current product prices...</p>}

          <button
            className="primary-btn checkout-submit"
            type="submit"
            disabled={isSubmitting || isQuoting || !quoteReady || Boolean(quoteError) || items.length === 0}
          >
            {isSubmitting ? 'Connecting to Paystack...' : isQuoting ? 'Checking current prices...' : 'Pay with Paystack'}
          </button>
          <p className="checkout-payment-note">You will be redirected to Paystack to complete your payment in NGN.</p>
        </form>

        <aside className="checkout-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <div className="checkout-items">
            {items.map((item) => (
              <div className="checkout-summary-item" key={item.product_id}>
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <span>Qty {item.quantity}</span>
                  {item.customizationNotes && (
                    <span className="checkout-item__customization">
                      Request: {item.customizationNotes}
                    </span>
                  )}
                </div>
                <span>{formatCurrency(Number(item.price) * item.quantity)}</span>
              </div>
                
            ))}
          </div>
          <div className="checkout-total">
            <span>Total</span>
            <strong>{formatCurrency(quoteTotal)}</strong>
          </div>
        </aside>
      </div>

      <dialog
        ref={paymentConfirmationDialogRef}
        className="logout-dialog checkout-confirm-dialog"
        aria-labelledby="payment-confirmation-title"
        aria-describedby="payment-confirmation-description"
        onClose={() => {
          setIsPaymentConfirmationOpen(false)
          setPendingOrderDetails(null)
        }}
      >
        <div className="logout-dialog__content">
          <h2 id="payment-confirmation-title">Confirm your payment</h2>
          <p id="payment-confirmation-description">
            Your order total is {formatCurrency(quoteTotal)}. Continue to Paystack to complete your payment securely in NGN.
          </p>
          <div className="logout-dialog__actions">
            <button
              type="button"
              className="logout-dialog__cancel"
              onClick={() => setIsPaymentConfirmationOpen(false)}
              disabled={isSubmitting}
              autoFocus
            >
              Review details
            </button>
            <button
              type="button"
              className="logout-dialog__confirm"
              onClick={handleConfirmPayment}
              disabled={isSubmitting || isQuoting || !quoteReady || !pendingOrderDetails}
            >
              {isSubmitting ? 'Connecting to Paystack...' : 'Continue to payment'}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  )
}

export default Checkout

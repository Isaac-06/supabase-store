function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value) || 0)
}

function Checkout({ items = [], email, onBack, onPlaceOrder, isSubmitting, error }) {
  const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

  function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    onPlaceOrder(Object.fromEntries(formData.entries()))
  }

  return (
    <section className="checkout-page">
      <button type="button" className="details-back" onClick={onBack}>
        Back to cart
      </button>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <p className="eyebrow">Checkout</p>
          <h1>Delivery details</h1>
          <p className="checkout-account">Signed in as <strong>{email}</strong></p>

          <div className="checkout-fields">
            <label>
              Full name
              <input name="customerName" type="text" autoComplete="name" maxLength="120" required />
            </label>
            <label>
              Phone number
              <input name="phone" type="tel" autoComplete="tel" maxLength="40" required />
            </label>
            <label className="checkout-field-full">
              Address
              <input name="addressLine1" type="text" autoComplete="address-line1" maxLength="200" required />
            </label>
            <label className="checkout-field-full">
              Apartment, suite, etc. (optional)
              <input name="addressLine2" type="text" autoComplete="address-line2" maxLength="200" />
            </label>
            <label>
              City
              <input name="city" type="text" autoComplete="address-level2" maxLength="100" required />
            </label>
            <label>
              Postal code
              <input name="postalCode" type="text" autoComplete="postal-code" maxLength="24" required />
            </label>
            <label className="checkout-field-full">
              Country or region
              <input name="country" type="text" autoComplete="country-name" maxLength="100" required />
            </label>
          </div>

          {error && <p className="checkout-error" role="alert">{error}</p>}

          <button className="primary-btn checkout-submit" type="submit" disabled={isSubmitting || items.length === 0}>
            {isSubmitting ? 'Saving order...' : 'Place order'}
          </button>
          <p className="checkout-payment-note">No payment is collected in this checkout version.</p>
        </form>

        <aside className="checkout-summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <div className="checkout-items">
            {items.map((item) => (
              <div className="checkout-summary-item" key={item.id}>
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <span>Qty {item.quantity}</span>
                </div>
                <span>{formatCurrency(Number(item.price) * item.quantity)}</span>
              </div>
                
            ))}
          </div>
          <div className="checkout-total">
            <span>Total</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default Checkout

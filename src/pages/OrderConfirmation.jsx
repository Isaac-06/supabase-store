function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value) || 0)
}

function OrderConfirmation({ order, onContinueShopping }) {
  return (
    <section
      className="order-confirmation"
      aria-labelledby="order-confirmation-title"
    >
      <p className="eyebrow">Order received</p>

      <h1 id="order-confirmation-title">
        Thank you, {order.customer_name}.
      </h1>

      <p className="order-confirmation-message">
        Your order has been saved. Payment has not been collected.
      </p>

      <dl className="order-confirmation-details">
        <div>
          <dt>Order number</dt>
          <dd>#{order.order_id}</dd>
        </div>

        <div>
          <dt>Status</dt>
          <dd>Pending</dd>
        </div> 

        <div>
          <dt>Order total</dt>
          <dd>{formatCurrency(order.total_amount)}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="primary-btn"
        onClick={onContinueShopping}
      >
        Continue shopping
      </button>
    </section>
  )
}

export default OrderConfirmation

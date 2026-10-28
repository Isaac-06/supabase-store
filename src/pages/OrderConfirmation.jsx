import { formatCurrency } from '../utils/currency'

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
        Your payment has been confirmed and your order has been placed.
      </p>

      <dl className="order-confirmation-details">
        <div>
          <dt>Order number</dt>
          <dd>#{order.order_id}</dd>
        </div>

        <div>     
          <dt>Status</dt>
          <dd>Paid</dd>
        </div> 

        <div>
          <dt>Order total</dt>
          <dd>{formatCurrency(order.total_amount)}</dd>
        </div>
      </dl>

      {order.items?.some((item) => item.customization_notes) && (
        <section className="order-confirmation-requests" aria-labelledby="order-requests-title">
          <h2 id="order-requests-title">Product requests</h2>
          {order.items.filter((item) => item.customization_notes).map((item) => (
            <p key={item.product_id}>
              <strong>{item.name}:</strong> {item.customization_notes}
            </p>
          ))}
          <span>Your requests have been saved with this order and are subject to availability.</span>
        </section>
      )}

      <button
        type="button"
        className="primary-btn"
        onClick={onContinueShopping}      
      >
        Continue shopping.
      </button>
    </section>
  )
}

export default OrderConfirmation

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { formatCurrency } from '../utils/currency'

function formatConfirmationDate(value, status) {
  if (!value) return status === 'paid' ? 'Confirmation date unavailable' : 'Payment not confirmed'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Confirmation date unavailable'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function Orders({ userId }) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadOrders() {
      setIsLoading(true)
      setError('')

      const { data, error: queryError } = await supabase
        .from('orders')
        .select('id, status, total_amount, items, payment_confirmed_at')
        .eq('user_id', userId)
        .order('payment_confirmed_at', { ascending: false, nullsFirst: false })

      if (!isActive) return

      if (queryError) {
       console.error(queryError);
        setError('Your orders could not be loaded. Please try again.')
      } else {
        setOrders(data ?? [])
      }
      setIsLoading(false)
    }

    void loadOrders()

    return () => {
      isActive = false
    }
  }, [userId])

  return (
    <section className="orders-page" aria-labelledby="orders-title">
      <div className="orders-page__header">
        <div className="orders-page__heading">
          <button
            type="button"
            className="back-arrow-button"
            aria-label="Back to home"
            title="Back to home"
            onClick={() => navigate('/shop')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span>
          </button>
          <div>
            <p className="eyebrow">Your account</p>
            <h1 id="orders-title">Your orders</h1>
            <p>Review your order history and payment confirmation dates.</p>
          </div>
        </div>
        <button type="button" className="categories-browse-all" onClick={() => navigate('/shop')}>
          Continue shopping
        </button>
      </div>

      {isLoading && <p className="product-status" role="status">Loading your orders...</p>}
      {error && <p className="product-status error" role="alert">{error}</p>}
      {!isLoading && !error && orders.length === 0 && (
        <p className="orders-page__empty">You have no past orders yet.</p>
      )}
      {!isLoading && !error && orders.length > 0 && (
        <div className="orders-list">
          {orders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : []

            return (
              <article className="orders-card" key={order.id}>
                <header className="orders-card__header">
                  <div>
                    <h2>Order #{order.id}</h2>
                    <p>{formatConfirmationDate(order.payment_confirmed_at, order.status)}</p>
                  </div>
                  <span className="orders-card__status">{order.status || 'Unknown'}</span>
                </header>

                {items.length > 0 ? (
                  <ul className="orders-card__items">
                    {items.map((item, index) => (
                      <li key={`${item.product_id ?? item.name ?? 'item'}-${index}`}>
                        <span>{item.name || 'Product'}{item.quantity ? ` × ${item.quantity}` : ''}</span>
                        {item.customization_notes && <small>{item.customization_notes}</small>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="orders-card__no-items">Item details are unavailable.</p>
                )}

                <p className="orders-card__total">
                  <span>Order total</span>
                  <strong>{formatCurrency(Number(order.total_amount) || 0)}</strong>
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default Orders

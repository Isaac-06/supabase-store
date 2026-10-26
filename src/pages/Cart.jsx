import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../utils/currency'

export default function Cart({ items = [], removeFromCart, updateQuantity, onCheckout, onBack }) {
  const [itemToRemove, setItemToRemove] = useState(null)
  const removeDialogRef = useRef(null)
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    const dialog = removeDialogRef.current
    if (!dialog) return

    if (itemToRemove && !dialog.open) {
      dialog.showModal()
    } else if (!itemToRemove && dialog.open) {
      dialog.close()
    }
  }, [itemToRemove])

  return (
    <div className="cart">
      <div className="cart-header">
        <button type="button" className="back-arrow-button" aria-label="Back to shop" title="Back to shop" onClick={onBack}>
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span>
        </button>
        <h2>Your Cart</h2>
      </div>

      {items.length === 0 ? (
        <p className="cart-empty">Your cart is empty.</p>
      ) : (
        <>

          {items.map((item) => (
            <div key={item.id} className="cart-item">
              <img src={item.image} alt={item.name} width="80" />
              <div>
                <h3>{item.name}</h3>
                <p>{formatCurrency(item.price)}</p>
              </div>

              <div className="cart-controls">
                <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                  -
                </button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setItemToRemove(item)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <h3>Total: {formatCurrency(total)}</h3>
          <button type="button" className="primary-btn cart-checkout" onClick={onCheckout}>
            Proceed to checkout
          </button>
        </>
      )}

      <dialog
        ref={removeDialogRef}
        className="logout-dialog"
        aria-labelledby="remove-cart-item-title"
        aria-describedby="remove-cart-item-description"
        onClose={() => setItemToRemove(null)}
      >
        <div className="logout-dialog__content">
          <h2 id="remove-cart-item-title">Remove item?</h2>
          <p id="remove-cart-item-description">
            Are you sure you want to remove {itemToRemove?.name} from your cart?
          </p>
          <div className="logout-dialog__actions">
            <button
              type="button"
              className="logout-dialog__cancel"
              onClick={() => setItemToRemove(null)}
              autoFocus
            >
              Cancel
            </button>
            <button
              type="button"
              className="logout-dialog__confirm"
              onClick={() => {
                if (itemToRemove) removeFromCart(itemToRemove.id)
                setItemToRemove(null)
              }}
            >
              Remove
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
export default function Cart({ items = [], removeFromCart, updateQuantity }) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  if (items.length === 0) {
    return <div>Your cart is empty.</div>
  }

  return (
    <div className="cart">
      <h2>Your Cart</h2>  

      {items.map((item) => (
        <div key={item.id} className="cart-item">
          <img src={item.image} alt={item.name} width="80" />
          <div>
            <h3>{item.name}</h3>
            <p>${item.price}</p>
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
              onClick={() => {
                if (window.confirm(`Remove ${item.name} from your cart?`)) {
                  removeFromCart(item.id)
                }
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <h3>Total: ${total}</h3>
    </div>
  )
}
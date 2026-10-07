function ProductCard({ product, addToCart, onViewProduct }) {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} width="200" />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button type="button" onClick={() => onViewProduct(product)}>
        View Product
      </button>
      <button type="button" onClick={() => addToCart(product)}>
        Add to Cart
      </button>
    </div>
  )
}

export default ProductCard

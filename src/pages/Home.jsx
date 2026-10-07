import ProductCard from '../components/ProductCard'

function Home({ products = [], addToCart, onViewProduct }) {
  return (
    <section className="products-section" id="products">
      <div className="section-header">
        <h2>Popular picks</h2>
        <p>Curated for modern living</p>
      </div>

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            addToCart={addToCart}
            onViewProduct={onViewProduct}
            showMore={product.id === 3}
          />
        ))}
      </div>
    </section>
  )
}

export default Home

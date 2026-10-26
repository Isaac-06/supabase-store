import ProductCard from '../components/ProductCard'

function Home({ products = [], addToCart, onViewProduct, selectedCategory, onClearCategory, onBack }) {
  return (
    <section className="products-section" id="products">
      <div className="section-header">
        <div className="section-heading">
          <button type="button" className="back-arrow-button" aria-label="Back to home" title="Back to home" onClick={onBack}>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span>
          </button>
          <div>
            <h2>{selectedCategory || 'Popular picks'}</h2>
            <p>{selectedCategory ? `Products in ${selectedCategory}` : 'Curated for modern living'}</p>
          </div>
        </div>
        {selectedCategory && (
          <button type="button" className="categories-browse-all" onClick={onClearCategory}>
            View all products
          </button>
      
        )}
      </div>

      {products.length > 0 ? (
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
      ) : (
        <p className="product-status">No products found in this category.</p>
      )}
    </section>
  )
}

export default Home

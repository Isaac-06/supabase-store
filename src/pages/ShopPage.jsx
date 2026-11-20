import { useNavigate, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { getProductCategory } from '../utils/products'

function ShopPage({ products = [], productsLoading, productsError, addToCart, onViewProduct }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategory = searchParams.get('category')
  const filteredProducts = selectedCategory
    ? products.filter((product) => getProductCategory(product) === selectedCategory)
    : products

  return (
    <section className="products-section" id="products">
      <div className="section-header">
        <div className="section-heading">
          <button type="button" className="back-arrow-button" aria-label="Back to home" title="Back to home" onClick={() => navigate('/')}>
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span>
          </button>
          <div>
            <h2>{selectedCategory || 'Popular picks'}</h2>
            <p>{selectedCategory ? `Products in ${selectedCategory}` : 'Curated for modern living'}</p>
          </div>
        </div>
        {selectedCategory && (
          <button type="button" className="categories-browse-all" onClick={() => setSearchParams({}, { replace: true })}>
            View all products
          </button>
        )}
      </div>

      {productsLoading && <p className="product-status" role="status">Loading products...</p>}
      {productsError && <p className="product-status error" role="alert">Could not load products: {productsError}</p>}
      {!productsLoading && !productsError && filteredProducts.length > 0 ? (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              addToCart={addToCart}
              onViewProduct={onViewProduct}
            />
          ))}
        </div>
      ) : !productsLoading && !productsError ? (
        <p className="product-status">
          {selectedCategory ? 'No products found in this category.' : 'No products are available yet.'}
        </p>
      ) : null}
    </section>
  )
}

export default ShopPage

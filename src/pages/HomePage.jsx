import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { getProductCategory } from '../utils/products'

function HomePage({
  products = [],
  productsLoading,
  productsError,
  onViewProduct,
  addToCart,
}) {
  const navigate = useNavigate()
  const [heroSlide, setHeroSlide] = useState(0)
  const [isHeroPlaying, setIsHeroPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const categories = [...new Set(
    products.map(getProductCategory).filter(Boolean)
  )].sort((left, right) => left.localeCompare(right))
  const activeHeroSlide = products.length > 0 ? heroSlide % products.length : 0
  const activeHeroProduct = products[activeHeroSlide]

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionPreferenceChange = (event) => {
      if (event.matches) setIsHeroPlaying(false)
    }

    motionPreference.addEventListener('change', handleMotionPreferenceChange)
    return () => motionPreference.removeEventListener('change', handleMotionPreferenceChange)
  }, [])

  useEffect(() => {
    if (products.length < 2 || !isHeroPlaying) return undefined

    const intervalId = window.setInterval(() => {
      setHeroSlide((current) => (current + 1) % products.length)
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [isHeroPlaying, products.length])

  return (
    <>
      {products.length > 0 && (
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">New season essentials</p>
            <h1>Upgrade your setup with smarter tech.</h1>
            <p className="hero-text">
              Discover premium gear built for performance, comfort, and everyday life.
            </p>

            <div className="hero-actions">
              <button type="button" className="primary-btn" onClick={() => navigate('/shop')}>Shop now</button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => document.getElementById('shop-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Explore categories
              </button>
            </div>

            <div className="hero-stats">
              <div>
                <strong>{products.length}</strong>
                <span>Products to explore</span>
              </div>
              <div>
                <strong>{categories.length}</strong>
                <span>Shop categories</span>
              </div>
              <div className="hero-stats__payment" aria-label="Payment partner: Paystack">
                <span className="hero-stats__payment-label">Payment partner</span>
                <img className="hero-stats__logo" src="/paystack.png" alt="Paystack" />
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-carousel" aria-label="Featured products">
              <div className="hero-carousel__image-wrap">
                <img
                  className="hero-carousel__image"
                  src={activeHeroProduct.image}
                  alt={activeHeroProduct.name}
                  key={activeHeroProduct.id}
                />
                <span className="hero-carousel__counter" aria-live="polite">
                  {activeHeroSlide + 1} / {products.length}
                </span>
              </div>

              <div className="hero-carousel__footer">
                <div className="hero-carousel__product">
                  <span className="hero-carousel__eyebrow">Featured product</span>
                  <h2>{activeHeroProduct.name}</h2>
                </div>
                <button type="button" className="hero-carousel__view" onClick={() => onViewProduct(activeHeroProduct)}>
                  View product
                </button>
              </div>

              {products.length > 1 && (
                <div className="hero-carousel__controls" aria-label="Featured product controls">
                  <button
                    type="button"
                    className="hero-carousel__arrow"
                    aria-label="Previous featured product"
                    onClick={() => setHeroSlide((current) => (current - 1 + products.length) % products.length)}
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <div className="hero-carousel__dots" aria-label="Choose a featured product">
                    {products.map((product, index) => (
                      <button
                        key={product.id ?? product.name}
                        type="button"
                        className={`hero-carousel__dot${index === activeHeroSlide ? ' is-active' : ''}`}
                        aria-label={`Show ${product.name}`}
                        aria-current={index === activeHeroSlide ? 'true' : undefined}
                        onClick={() => setHeroSlide(index)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="hero-carousel__autoplay"
                    aria-label={isHeroPlaying ? 'Pause automatic slide rotation' : 'Resume automatic slide rotation'}
                    aria-pressed={!isHeroPlaying}
                    onClick={() => setIsHeroPlaying((playing) => !playing)}
                  >
                    {isHeroPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    className="hero-carousel__arrow"
                    aria-label="Next featured product"
                    onClick={() => setHeroSlide((current) => (current + 1) % products.length)}
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="categories-section" id="shop-categories" aria-labelledby="categories-title">
        <div className="section-header">
          <div>
            <p className="eyebrow categories-eyebrow">Category</p>
            <h2 id="categories-title">Shop by category</h2>
            <p>Find the right gear for every part of your setup</p>
          </div>
          <button type="button" className="categories-browse-all" onClick={() => navigate('/shop')}>
            Browse all products
          </button>
        </div>

        {productsLoading && <p className="product-status" role="status">Loading categories...</p>}
        {productsError && <p className="product-status error" role="alert">Could not load categories: {productsError}</p>}
        {!productsLoading && !productsError && categories.length > 0 && (
          <div className="category-grid">
            {categories.map((category) => {
              const categoryProducts = products.filter((product) => getProductCategory(product) === category)
              const categoryImage = categoryProducts.find((product) => product.image)?.image

              return (
                <button
                  key={category}
                  type="button"
                  className="category-card"
                  onClick={() => navigate(`/shop?category=${encodeURIComponent(category)}`)}
                >
                  {categoryImage && <img src={categoryImage} alt="" />}
                  <span className="category-card__content">
                    <strong>{category}</strong>
                    <span>{categoryProducts.length} {categoryProducts.length === 1 ? 'product' : 'products'}</span>
                  </span>
                  <span className="category-card__arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
          </div>
        )}
        {!productsLoading && !productsError && products.length === 0 && (
          <p className="product-status">Categories will appear when products are available.</p>
        )}
        {!productsLoading && !productsError && products.length > 0 && categories.length === 0 && (
          <p className="product-status">No product categories are available yet.</p>
        )}
      </section>

      {products.length > 0 && (
        <section className="home-featured-section" aria-labelledby="home-featured-title">
          <div className="section-header">
            <div>
              <h2 id="home-featured-title">Explore products</h2>
              <p>A few products to get you started</p>
            </div>
            <button type="button" className="categories-browse-all" onClick={() => navigate('/shop')}>
              View all products
            </button>
          </div>
          <div className="product-grid">
            {products.slice(0, 4).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                addToCart={addToCart}
                onViewProduct={onViewProduct}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export default HomePage

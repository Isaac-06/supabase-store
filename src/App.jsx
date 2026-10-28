import { useEffect, useRef, useState } from 'react'
import './App.css'
import Home from './pages/Home'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import ProductDetails from './pages/ProductDetails'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import { getSupabaseConfigError, isSupabaseConfigured, supabase } from './supabase.js'

const savedCartKey = 'neoncart-items'

function asNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeCartItem(item) {
  if (!item || typeof item !== 'object') return null

  const quantity = Math.max(0, Math.trunc(asNumber(item.quantity, 1)))
  const price = asNumber(item.price, 0)

  return {
    ...item,
    quantity: quantity || 0,
    price,
  }
}

function getProductCategory(product) {
  const category = product.specifications?.Category
  const use = product.specifications?.Use
  const isGamingProduct = [category, use, product.name].some(
    (value) => typeof value === 'string' && /\bgaming\b/i.test(value)
  )

  if (isGamingProduct) return 'Gaming'
  return typeof category === 'string' ? category.trim() : ''
}

function getSavedCartItems() {
  try {
    const savedItems = window.localStorage.getItem(savedCartKey)
    const parsedItems = savedItems ? JSON.parse(savedItems) : []
    if (!Array.isArray(parsedItems)) return []
    return parsedItems.map(normalizeCartItem).filter(Boolean)
  } catch (error) {
    console.error('Could not restore cart:', error)
    return []
  }
}

function App() {
  const [cartItems, setCartItems] = useState(getSavedCartItems)
  const [paymentReference, setPaymentReference] = useState(() => {
    const callbackUrl = new URL(window.location.href)
    if (callbackUrl.searchParams.get('payment') !== 'paystack') return null
    return callbackUrl.searchParams.get('reference') || callbackUrl.searchParams.get('trxref') || ''
  })
  const [currentView, setCurrentView] = useState('account')
  const [authMode, setAuthMode] = useState('login')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [heroSlide, setHeroSlide] = useState(0)
  const [isHeroPlaying, setIsHeroPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [user, setUser] = useState(null)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [completedOrder, setCompletedOrder] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const toastTimer = useRef(null)
  const logoutDialogRef = useRef(null)
  const isRecoveringPassword = useRef(false)
  const shouldScrollToAbout = useRef(false)

  useEffect(() => {
    const dialog = logoutDialogRef.current
    if (!dialog) return

    if (isLogoutDialogOpen && !dialog.open) {
      dialog.showModal()
    } else if (!isLogoutDialogOpen && dialog.open) {
      dialog.close()
    }
  }, [isLogoutDialogOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(savedCartKey, JSON.stringify(cartItems))
    } catch (error) {
      console.error('Could not save cart:', error)
    }
  }, [cartItems])

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      if (!isSupabaseConfigured) {
        if (!isMounted) return
        setProductsError(getSupabaseConfigError())
        setProductsLoading(false)
        return
      }

      const { data, error } = await supabase.from('products').select('*').order('id')
      if (!isMounted) return

      if (error) {
        setProductsError(error.message)
      } else {
        setProducts(data.map((product) => ({
          ...product,
          varieties: Array.isArray(product.varieties) ? product.varieties.flat() : [],
          specifications: product.specifications && typeof product.specifications === 'object' ? product.specifications : {},
        })))
      }
      setProductsLoading(false)
    }

    loadProducts()
    if (!isSupabaseConfigured) return () => {
      isMounted = false
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return

      const session = data.session
      setUser(session?.user ?? null)
      if (
        !isRecoveringPassword.current
        && new URLSearchParams(window.location.search).get('payment') !== 'paystack'
      ) {
        setCurrentView(session ? 'home' : 'account')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN') setCurrentView('home')
      if (event === 'PASSWORD_RECOVERY') {
        isRecoveringPassword.current = true
        setAuthMode('reset')
        setCurrentView('account')
      }
      if (event === 'SIGNED_OUT') {
        setAuthMode('login')
        setCurrentView('account')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

    const showToast = (message) => {
    setToastMessage(message)

    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
    }

    toastTimer.current = setTimeout(() => {
      setToastMessage('')
    }, 2200)
  }

  const addToCart = (product, customizationNotes = '') => {
    setCartItems((currentItems) => {
      const normalizedProduct = normalizeCartItem(product)
      const existingItem = currentItems.find((item) => item.id === product.id)

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === product.id
            ? {
                ...normalizeCartItem(item),
                quantity: Math.max(0, asNumber(item.quantity, 1) + 1),
                customizationNotes: customizationNotes || item.customizationNotes || '',
              }
            : item
        )
      }

      return [...currentItems, normalizedProduct
        ? { ...normalizedProduct, quantity: 1, customizationNotes }
        : { ...product, quantity: 1, customizationNotes }]
    })

    showToast(`${product.name} added to cart successfully!`)
  }

  const removeFromCart = (id) => {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    )
  }

  const updateQuantity = (id, nextQuantity) => {
    setCartItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.id !== id) return [item]

        const quantity = Math.max(0, Math.trunc(asNumber(nextQuantity, 0)))
        return quantity === 0 ? [] : [{ ...normalizeCartItem(item), quantity }]
      })
    )
  }
const placeOrder = async (deliveryDetails) => {
  if (!user || cartItems.length === 0 || isSubmittingOrder) return

  setCheckoutError('')
  setIsSubmittingOrder(true)

  const deliveryAddress = {
    customer_name: deliveryDetails.customerName.trim(),
    phone: deliveryDetails.phone.trim(),
    address_line_1: deliveryDetails.addressLine1.trim(),
    address_line_2: deliveryDetails.addressLine2.trim(),
    city: deliveryDetails.city.trim(),
    postal_code: deliveryDetails.postalCode.trim(),
    country: deliveryDetails.country.trim(),
  }

  try {
    const { data, error } = await supabase.functions.invoke('paystack-payments', {
      body: {
        action: 'initialize',
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          customization_notes: item.customizationNotes || '',
        })),
        delivery_address: deliveryAddress,
      },
    })

    if (error) throw error
    if (!data?.authorization_url) throw new Error('Paystack did not return a payment link.')
    window.location.assign(data.authorization_url)
  } catch (error) {
    console.error('Could not start Paystack payment:', error)
    setCheckoutError(error.message || 'Could not start payment. Please try again.')
  } finally {
    setIsSubmittingOrder(false)
  }
}
  

  const totalItems = cartItems.reduce((sum, item) => sum + Math.max(0, Math.trunc(asNumber(item.quantity, 0))), 0)
  const activeHeroSlide = products.length > 0 ? heroSlide % products.length : 0
  const activeHeroProduct = products[activeHeroSlide]
  const categories = [...new Set(
    products
      .map(getProductCategory)
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right))
  const displayName = typeof user?.user_metadata?.name === 'string'
    ? user.user_metadata.name.trim()
    : ''

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleMotionPreferenceChange = (event) => {
      if (event.matches) setIsHeroPlaying(false)
    }

    motionPreference.addEventListener('change', handleMotionPreferenceChange)
    return () => motionPreference.removeEventListener('change', handleMotionPreferenceChange)
  }, [])

  useEffect(() => {
    if (currentView !== 'home' || products.length < 2 || !isHeroPlaying) return

    const intervalId = window.setInterval(() => {
      setHeroSlide((activeHeroSlide + 1) % products.length)
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [activeHeroSlide, currentView, isHeroPlaying, products.length])

  useEffect(() => {
    if (currentView !== 'home' || !shouldScrollToAbout.current) return

    document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    shouldScrollToAbout.current = false
  }, [currentView])

  useEffect(() => {
    if (paymentReference === null || !user) return
    let isActive = true

    async function verifyPayment() {
      setCurrentView('payment')

      try {
        if (!paymentReference) {
          throw new Error('Paystack did not return a payment reference. Please try again.')
        }
        const { data, error } = await supabase.functions.invoke('paystack-payments', {
          body: { action: 'verify', reference: paymentReference },
        })
        if (error) throw error
        if (!data?.paid) throw new Error(data?.message || 'Payment could not be confirmed.')

        if (isActive) {
          setCompletedOrder(data.order)
          setCartItems([])
          setCurrentView('confirmation')
        }
      } catch (error) {
        console.error('Could not verify Paystack payment:', error)
        if (isActive) {
          setCheckoutError(error.message || 'Could not verify payment. Please try again.')
          setCurrentView('checkout')
        }
      } finally {
        const callbackUrl = new URL(window.location.href)
        callbackUrl.searchParams.delete('payment')
        callbackUrl.searchParams.delete('reference')
        callbackUrl.searchParams.delete('trxref')
        window.history.replaceState({}, '', callbackUrl)
        setPaymentReference(null)
      }
    }

    void verifyPayment()

    return () => {
      isActive = false
    }
  }, [paymentReference, user])

  const handleLogout = async () => {
    setIsSigningOut(true)
    setLogoutError('')

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Could not sign out:', error.message)
        setLogoutError(error.message)
        return
      }

      setIsLogoutDialogOpen(false)
      setAuthMode('login')
      setCurrentView('account')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
      console.error('Could not sign out:', error)
      setLogoutError(message)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="app-shell">
      {toastMessage && (
        <div className="toast-success" role="status" aria-live="polite">
          <span className="toast-success__icon" aria-hidden="true" />
          <div className="toast-success__content">
            <strong>Success!</strong>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">N</div>
          <span>NeonCart</span>
        </div>

        {user && <nav className="nav">
          <button type="button" onClick={() => setCurrentView('home')}>Home</button>
          <button type="button" onClick={() => { setSelectedCategory(null); setCurrentView('shop') }}>Shop</button>
          <button type="button" onClick={() => {
            if (currentView === 'home') {
              document.getElementById('about-us')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              return
            }
            shouldScrollToAbout.current = true
            setCurrentView('home')
          }}>About Us</button>
        </nav>}

        <div className="account-actions">
          {user ? (
            <>
              <div className="welcome-user" aria-label={`Welcome, ${displayName || 'back'}`}>
                <span className="welcome-user__avatar" aria-hidden="true">
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="welcome-user__text">
                  <span className="welcome-user__label">Welcome</span>
                  <strong>{displayName || 'back'}</strong>
                </span>
              </div>
              <button
                type="button"
                className="account-button"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => {
                  setLogoutError('')
                  setIsLogoutDialogOpen(true)
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">logout</span>
              </button>
              <button
                type="button"
                className="cart-badge"
                aria-label={`Cart, ${totalItems} items`}
                title="Cart"
                onClick={() => setCurrentView('cart')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">shopping_cart</span>
                <span className="cart-badge__count">{totalItems}</span>
              </button>
            </>
          ) : null}
        </div>
      </header>

      <main className="page-content">
        {currentView === 'home' && products.length > 0 && <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">New season essentials</p>
            <h1>Upgrade your setup with smarter tech.</h1>
            <p className="hero-text">
              Discover premium gear built for performance, comfort, and everyday life.
            </p>

            <div className="hero-actions">
              <button type="button" className="primary-btn" onClick={() => { setSelectedCategory(null); setCurrentView('shop') }}>Shop now</button>
              <button type="button" className="secondary-btn" onClick={() => { setSelectedCategory(null); setCurrentView('shop') }}>Browse deals</button>
            </div>
               
               
            <div className="hero-stats">
              <div>
                <strong>4.9/5</strong>
                <span>Customer rating</span>
              </div>
              <div>
                <strong>2k+</strong>
                <span>Products sold</span>
              </div>
              <div>
                <strong>24h</strong>
                <span>Fast shipping</span>
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
                <button
                  type="button"
                  className="hero-carousel__view"
                  onClick={() => {
                    setSelectedProduct(activeHeroProduct)
                    setCurrentView('details')
                  }}
                >
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
        </section>}

        {currentView === 'home' && (
          <section className="categories-section" aria-labelledby="categories-title">
            <div className="section-header">
              <div>
                <p className="eyebrow categories-eyebrow">Category</p>
                <h2 id="categories-title">Shop by category</h2>
                <p>Find the right gear for every part of your setup</p>
              </div>
              <button
                type="button"
                className="categories-browse-all"
                onClick={() => {
                  setSelectedCategory(null)
                  setCurrentView('shop')
                }}
              >
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
                      onClick={() => {
                        setSelectedCategory(category)
                        setCurrentView('shop')
                      }}
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
        )}

        {currentView === 'home' && (
          <section className="about-section" id="about-us" aria-labelledby="about-us-title">
            <p className="eyebrow">About NeonCart</p>
            <h2 id="about-us-title">Tech for work, play, and everyday life.</h2>
            <p>
              We make it easier to find the right gear for your setup by bringing thoughtfully
              selected products together in one place, so you can spend less time searching and
              more time enjoying your technology.
            </p>
          </section>
        )}

        {currentView === 'shop' && (
          <Home
            products={selectedCategory
              ? products.filter((product) => getProductCategory(product) === selectedCategory)
              : products}
            addToCart={addToCart}
            selectedCategory={selectedCategory}
            onClearCategory={() => setSelectedCategory(null)}
            onBack={() => setCurrentView('home')}
            onViewProduct={(product) => {
              setSelectedProduct(product)
              setCurrentView('details')
            }}
          />
        )}
        {currentView === 'shop' && productsLoading && <p className="product-status" role="status">Loading products...</p>}
        {currentView === 'shop' && productsError && <p className="product-status error" role="alert">Could not load products: {productsError}</p>}
        {currentView === 'shop' && !productsLoading && !productsError && products.length === 0 && <p className="product-status">No products are available yet.</p>}
        {currentView === 'account' && (
          <section className="account-page">
            {authMode !== 'reset' && <div className="auth-tabs" role="tablist" aria-label="Account">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signup'}
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                Sign up
              </button>
            </div>}
            {authMode === 'login' || authMode === 'reset'
              ? <Login
                  onAuthenticated={() => setCurrentView('home')}
                  isPasswordRecovery={authMode === 'reset'}
                  onPasswordUpdated={() => {
                    isRecoveringPassword.current = false
                    setAuthMode('login')
                    setCurrentView('home')
                  }}
                />
              : <SignUp onAuthenticated={() => setCurrentView('home')} />}
          </section>
        )}
        {currentView === 'details' && selectedProduct && (
          <ProductDetails
            product={selectedProduct}
            onBack={() => setCurrentView('shop')}
            onAddToCart={(customizationNotes) => {
              addToCart(selectedProduct, customizationNotes)
              setCurrentView('cart')
            }}
          />
        )}
        {currentView === 'cart' && (
          <Cart
            items={cartItems}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            onBack={() => setCurrentView('shop')}
            onCheckout={() => {
              setCheckoutError('')
              setCurrentView('checkout')
            }}
          />
        )}
        {currentView === 'checkout' && (
          <Checkout
            items={cartItems}
            email={user?.email ?? ''}
            onBack={() => setCurrentView('cart')}
            onPlaceOrder={placeOrder}
            isSubmitting={isSubmittingOrder}
            error={checkoutError}
          />
        )}
        {currentView === 'payment' && (
          <p className="product-status" role="status">Verifying your Paystack payment...</p>
        )}
        {currentView === 'confirmation' && completedOrder && (
          <OrderConfirmation
            order={completedOrder}
            onContinueShopping={() => setCurrentView('shop')}
          />
        )}
      </main>

      <dialog
        ref={logoutDialogRef}
        className="logout-dialog"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        onClose={() => setIsLogoutDialogOpen(false)}
        onCancel={(event) => {
          if (isSigningOut) event.preventDefault()
        }}
      >
        <div className="logout-dialog__content">
          <h2 id="logout-dialog-title">Sign out?</h2>
          <p id="logout-dialog-description">Are you sure you want to sign out of your account?</p>
          {logoutError && <p className="logout-dialog__error" role="alert">{logoutError}</p>}
          <div className="logout-dialog__actions">
            <button
              type="button"
              className="logout-dialog__cancel"
              onClick={() => setIsLogoutDialogOpen(false)}
              disabled={isSigningOut}
              autoFocus
            >
              Cancel
            </button>
            <button
              type="button"
              className="logout-dialog__confirm"
              onClick={handleLogout}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}


export default App;

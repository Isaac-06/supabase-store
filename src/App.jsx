import { useEffect, useRef, useState } from 'react'
import './App.css'
import Home from './pages/Home'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import ProductDetails from './pages/ProductDetails'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import { supabase } from './supabase.js'

function App() {
  const [cartItems, setCartItems] = useState([])
  const [currentView, setCurrentView] = useState('account')
  const [authMode, setAuthMode] = useState('login')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [user, setUser] = useState(null)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [completedOrder, setCompletedOrder] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const toastTimer = useRef(null)
  const isRecoveringPassword = useRef(false)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      const { data, error } = await supabase.from('products').select('*').order('id')
      if (!isMounted) return

      if (error) {
        setProductsError(error.message)
      } else {
        setProducts(data.map((product) => ({
          ...product,
          varieties: Array.isArray(product.varieties) ? product.varieties.flat(): [],
          specifications: product.specifications && typeof product.specifications === 'object' ? product.specifications : {},
        })))
      }
      setProductsLoading(false)
    }

    loadProducts()
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return

      const session = data.session
      setUser(session?.user ?? null)
      if (!isRecoveringPassword.current) setCurrentView(session ? 'home' : 'account')
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

  const addToCart = (product) => {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id)

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...currentItems, { ...product, quantity: 1 }]
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

        const quantity = Math.max(0, nextQuantity)
        return quantity === 0 ? [] : [{ ...item, quantity }]
      })
    )
  }
const placeOrder = async (deliveryDetails) => {
  if (!user || cartItems.length === 0 || isSubmittingOrder) return

  setCheckoutError('')
  setIsSubmittingOrder(true)

  const orderItems = cartItems.map((item) => ({
    product_id: item.id,
    quantity: item.quantity,
  }))

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
    const { data, error } = await supabase.rpc(
      'create_order',
      {
        order_items: orderItems,
        delivery_address: deliveryAddress,
      }
    )

    if (error) throw error

    console.log(data)

    setCompletedOrder(Array.isArray(data) ? data[0] : data)

    setCartItems([])

    setCurrentView('confirmation')
  } catch (error) {
    console.error('Could not save order:', error.message)

    setCheckoutError(
      'Your order could not be saved. Your cart is unchanged; please try again.'
    )
  } finally {
    setIsSubmittingOrder(false)
  }
}
  

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to sign out?')) return

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error(error.message)
      return
    }
    setAuthMode('login')
    setCurrentView('account')
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
          <button type="button" onClick={() => setCurrentView('shop')}>Shop</button>
          <button type="button" onClick={() => setCurrentView('cart')}>Cart</button>
        </nav>}

        <div className="account-actions">
          {user ? (
            <>
              <button type="button" className="account-button" onClick={handleLogout}>Sign out</button>
              <button type="button" className="cart-badge" onClick={() => setCurrentView('cart')}>Cart ({totalItems})</button>
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
              <button type="button" className="primary-btn" onClick={() => setCurrentView('shop')}>Shop now</button>
              <button type="button" className="secondary-btn" onClick={() => setCurrentView('shop')}>Browse deals</button>
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
           
          
          <div className="hero-visual" aria-label="Featured products">
            <div className="feature-card main-feature">
              <img src={products[0].image} alt={products[0].name} />
              <div>
              </div>
            </div>

            {products[1] && <div className="feature-card mini-feature one">
              <img src={products[1].image} alt={products[1].name} />
            </div>}

            {products[2] && <div className="feature-card mini-feature two">
              <img src={products[2].image} alt={products[2].name} />
            </div>}
          </div>
        </section>}

        {currentView === 'shop' && (
          <Home
            products={products}
            addToCart={addToCart}
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
            onAddToCart={() => {
              addToCart(selectedProduct)
              setCurrentView('cart')
            }}
          />
        )}
        {currentView === 'cart' && (
          <Cart
            items={cartItems}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
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
        {currentView === 'confirmation' && completedOrder && (
          <OrderConfirmation
            order={completedOrder}
            onContinueShopping={() => setCurrentView('shop')}
          />
        )}
      </main>
    </div>
  );
}


export default App;

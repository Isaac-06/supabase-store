import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import AboutUs from '../features/about/AboutUs'
import Cart from '../features/cart/Cart'
import Checkout from '../features/checkout/Checkout'
import OrderConfirmation from '../features/checkout/OrderConfirmation'
import Orders from '../features/orders/Orders'
import ProductDetails from '../features/catalog/ProductDetails'
import HomePage from '../features/catalog/HomePage'
import ShopPage from '../features/catalog/ShopPage'
import Login from '../features/auth/Login'
import SignUp from '../features/auth/SignUp'
import { useAuth } from '../features/auth/useAuth'
import useProducts from '../features/catalog/useProducts'
import { useCart } from '../features/cart/useCart'
import { useCheckout } from '../features/checkout/useCheckout'
import { isSupabaseConfigured } from '../shared/services/supabase.js'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const viewPaths = {
  home: '/',
  shop: '/shop',
  orders: '/orders',
  about: '/about',
  account: '/account',
  details: '/details',
  cart: '/cart',
  checkout: '/checkout',
  payment: '/payment',
  confirmation: '/confirmation',
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const setCurrentView = useCallback((view) => {
    const path = viewPaths[view]
    if (!path) throw new Error(`Unknown app view: ${view}`)
    navigate(path)
  }, [navigate])
  const { products, isLoading: productsLoading, error: productsError } = useProducts()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [toastMessage, setToastMessage] = useState('')
  const toastTimer = useRef(null)
  const {
    user,
    authInitialized,
    authMode,
    setAuthMode,
    displayName,
    setIsLogoutDialogOpen,
    isSigningOut,
    logoutError,
    setLogoutError,
    logoutDialogRef,
    handleLogout,
  } = useAuth(setCurrentView)
  const {
    cartItems,
    cartReady,
    totalItems,
    addToCart: addCartItem,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart(user, authInitialized)
  const {
    paymentReference,
    isSubmitting: isSubmittingOrder,
    error: checkoutError,
    completedOrder,
    deliveryProfile,
    deliveryProfileError,
    deliveryProfileReady,
    quoteItems,
    quoteTotal,
    quoteError,
    isQuoting,
    quoteReady,
    priceChanged,
    clearError: clearCheckoutError,
    refreshQuote,
    placeOrder,
  } = useCheckout({
    user,
    cartItems,
    cartReady,
    clearCart,
    setCurrentView,
    enabled: location.pathname === viewPaths.checkout,
  })

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
    addCartItem(product, customizationNotes)
    showToast(`${product.name} added to cart successfully!`)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const requireUser = (element) => {
    if (isSupabaseConfigured && !authInitialized) {
      return <p className="product-status" role="status">Loading your account...</p>
    }

    return user ? element : <Navigate to="/account" replace />
  }

  const homePage = (
    <HomePage
      products={products}
      productsLoading={productsLoading}
      productsError={productsError}
      onViewProduct={(product) => {
        setSelectedProduct(product)
        setCurrentView('details')
      }}
      addToCart={addToCart}
    />
  )

  const shopPage = (
    <ShopPage
      products={products}
      productsLoading={productsLoading}
      productsError={productsError}
      addToCart={addToCart}
      onViewProduct={(product) => {
        setSelectedProduct(product)
        setCurrentView('details')
      }}
    />
  )

  const aboutPage = <AboutUs />

  const accountPage = (
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
              setAuthMode('login')
              setCurrentView('home')
            }}
          />
        : <SignUp onAuthenticated={() => setCurrentView('home')} />}
    </section>
  )

  const detailsPage = selectedProduct
    ? (
      <ProductDetails
        product={selectedProduct}
        onBack={() => setCurrentView('shop')}
        onAddToCart={(customizationNotes) => {
          addToCart(selectedProduct, customizationNotes)
          setCurrentView('cart')
        }}
      />
    )
    : <Navigate to="/shop" replace />

  const cartPage = (
    <Cart
      items={cartItems}
      removeFromCart={removeFromCart}
      updateQuantity={updateQuantity}
      onBack={() => setCurrentView('shop')}
      onCheckout={() => {
        clearCheckoutError()
        setCurrentView('checkout')
      }}
    />
  )

  const checkoutPage = (
    <Checkout
      key={deliveryProfileReady ? `profile-${user?.id}` : `loading-${user?.id}`}
      items={quoteItems}
      email={user?.email ?? ''}
      phone={deliveryProfile?.phone ?? user?.user_metadata?.phone ?? ''}
      deliveryProfile={deliveryProfile}
      deliveryProfileError={deliveryProfileError}
      deliveryProfileReady={deliveryProfileReady}
      onBack={() => setCurrentView('cart')}
      onPlaceOrder={placeOrder}
      isSubmitting={isSubmittingOrder}
      error={checkoutError}
      quoteError={quoteError}
      quoteTotal={quoteTotal}
      isQuoting={isQuoting}
      quoteReady={quoteReady}
      priceChanged={priceChanged}
      onRefreshQuote={refreshQuote}
    />
  )

  const ordersPage = user
    ? <Orders userId={user.id} />
    : <Navigate to="/account" replace />

  const confirmationPage = completedOrder
    ? <OrderConfirmation order={completedOrder} onContinueShopping={() => setCurrentView('shop')} />
    : <Navigate to="/shop" replace />

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
        <Link to="/" className="brand-wrap" aria-label="NeonCart home">
          <div className="brand-mark">N</div>
          <span>NeonCart</span>
        </Link>

        {user && <nav className="nav">
          <button type="button" onClick={() => setCurrentView('home')}>Home</button>
          <button type="button" onClick={() => setCurrentView('shop')}>Shop</button>
          <button type="button" onClick={() => setCurrentView('orders')}>Orders</button>
          <button type="button" onClick={() => setCurrentView('about')}>About Us</button>
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
        <Routes>
          <Route path="/" element={requireUser(homePage)} />
          <Route path="/shop" element={requireUser(shopPage)} />
          <Route path="/orders" element={requireUser(ordersPage)} />
          <Route path="/about" element={requireUser(aboutPage)} />
          <Route
            path="/account"
            element={isSupabaseConfigured && !authInitialized
              ? <p className="product-status" role="status">Loading your account...</p>
              : user ? <Navigate to="/" replace /> : accountPage}
          />
          <Route path="/details" element={requireUser(detailsPage)} />
          <Route path="/cart" element={requireUser(cartPage)} />
          <Route path="/checkout" element={requireUser(checkoutPage)} />
          <Route
            path="/payment"
            element={requireUser(
              paymentReference !== null
                ? <p className="product-status" role="status">Verifying your Paystack payment...</p>
                : <Navigate to="/shop" replace />
            )}
          />
          <Route path="/confirmation" element={requireUser(confirmationPage)} />
          <Route path="*" element={<Navigate to={user ? '/' : '/account'} replace />} />
        </Routes>
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

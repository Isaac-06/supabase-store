import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import AboutUs from './pages/AboutUs'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import Orders from './pages/Orders'
import ProductDetails from './pages/ProductDetails'
import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import useProducts from './hooks/useProducts'
import { isSupabaseConfigured, supabase } from './supabase.js'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const savedCartKey = 'neoncart-items'
const guestCartKey = 'neoncart-guest-items'
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




function getSavedCartItems(userId) {
  if (!userId) return []

  try {
    const savedItems = window.localStorage.getItem(savedCartKey)
    const parsedCart = savedItems ? JSON.parse(savedItems) : null
    if (parsedCart?.userId !== userId || !Array.isArray(parsedCart.items)) return []
    return parsedCart.items.map(normalizeCartItem).filter(Boolean)
  } catch (error) {
    console.error('Could not restore cart:', error)
    return []
  }
}

function getSavedGuestCartItems() {
  try {
    const savedCart = window.localStorage.getItem(guestCartKey)
    const parsedCart = savedCart ? JSON.parse(savedCart) : null
    if (!Array.isArray(parsedCart?.items)) return []
    return parsedCart.items.map(normalizeCartItem).filter(Boolean)
  } catch (error) {
    console.error('Could not restore guest cart:', error)
    return []
  }
}

function mergeCartItems(savedItems, guestItems) {
  const mergedItems = savedItems.map(normalizeCartItem).filter(Boolean)

  guestItems.forEach((guestItem) => {
    const guestKey = String(guestItem.id ?? guestItem.product_id)
    const savedIndex = mergedItems.findIndex(
      (savedItem) => String(savedItem.id ?? savedItem.product_id) === guestKey
    )

    if (savedIndex === -1) {
      mergedItems.push(guestItem)
      return
    }

    const savedItem = mergedItems[savedIndex]
    mergedItems[savedIndex] = {
      ...savedItem,
      ...guestItem,
      quantity: savedItem.quantity + guestItem.quantity,
      customizationNotes: guestItem.customizationNotes || savedItem.customizationNotes || '',
    }
  })

  return mergedItems
}

async function loadCartFromSupabase(userId) {
  if (!userId || !isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map((row) => ({
      id: row.product_id,
      product_id: row.product_id,
      name: row.product_name,
      price: asNumber(row.price, 0),
      image: row.image || '',
      quantity: Math.max(1, Math.trunc(asNumber(row.quantity, 1))),
      customizationNotes: typeof row.customization_notes === 'string' ? row.customization_notes : '',
    }))
  } catch (error) {
    console.error('Could not load cart from Supabase:', error)
    return []
  }
}



async function saveCartToSupabase(userId, items) {
  if (!userId || !isSupabaseConfigured) return false
const {
  data: { user: authUser },
 } = await supabase.auth.getUser();

 console.log("Auth user:", authUser?.id);
 console.log("Save userId:", userId);

 if (!authUser || authUser.id !== userId) {
  console.warn("Skipping cart sync: auth session not ready");
  return false;
 }


  try {
    const normalizedItems = items
      .map((item) => {
        const normalized = normalizeCartItem(item)
        if (!normalized || !normalized.id) return null

        return {
          user_id: userId,
          product_id: Number(normalized.id),
          product_name: String(normalized.name || 'Product'),
          price: Number(normalized.price || 0),
          image: typeof normalized.image === 'string' ? normalized.image : '',
          quantity: Math.max(1, Math.trunc(asNumber(normalized.quantity, 1))),
          customization_notes: typeof normalized.customizationNotes === 'string' ? normalized.customizationNotes : '',
          updated_at: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    if (normalizedItems.length === 0) {
      const { error } = await supabase.from('cart_items').delete().eq('user_id', userId)
      if (error) throw error
      return true
    }
   



    const { error: upsertError } = await supabase
      .from('cart_items')
      .upsert(normalizedItems, { onConflict: 'user_id,product_id' })

    if (upsertError) throw upsertError

    const productIds = normalizedItems.map((item) => item.product_id)
    const { data: existingRows, error: fetchError } = await supabase
      .from('cart_items')
      .select('product_id')
      .eq('user_id', userId)

    if (fetchError) throw fetchError

    const staleIds = (existingRows ?? [])
      .map((row) => Number(row.product_id))
      .filter((productId) => !productIds.includes(productId))

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .in('product_id', staleIds)

      if (deleteError) throw deleteError
    }
    return true
  } catch (error) {
    console.error('Could not sync cart with Supabase:', error)
    return false
  }
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
  const [cartItems, setCartItems] = useState([])
  const [authInitialized, setAuthInitialized] = useState(false)
  const [cartReady, setCartReady] = useState(false)
  const [paymentReference, setPaymentReference] = useState(() => {
    const callbackUrl = new URL(window.location.href)
    if (callbackUrl.searchParams.get('payment') !== 'paystack') return null
    return callbackUrl.searchParams.get('reference') || callbackUrl.searchParams.get('trxref') || ''
  })
  const [authMode, setAuthMode] = useState('login')
  const [selectedProduct, setSelectedProduct] = useState(null)
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
  const activeUserId = useRef(null)
  const hasInitializedAuth = useRef(false)
  const cartTransitionId = useRef(0)
  useEffect(() => {
    console.log('Cart items:', cartItems)
  }, [cartItems])

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
    if (!authInitialized || !cartReady) return

    try {
      if (!user) {
        window.localStorage.setItem(guestCartKey, JSON.stringify({ items: cartItems }))
        return
      }

      if (!isSupabaseConfigured) {
        window.localStorage.setItem(savedCartKey, JSON.stringify({
          userId: user.id,
          items: cartItems,
        }))
        window.localStorage.removeItem(guestCartKey)
        return
      }

      window.localStorage.setItem(savedCartKey, JSON.stringify({
        userId: user.id,
        items: cartItems,
      }))
      window.localStorage.removeItem(guestCartKey)
      void saveCartToSupabase(user.id, cartItems)
    } catch (error) {
      console.error('Could not save cart:', error)
    }
  }, [authInitialized, cartItems, cartReady, user])

  const applyAuthSession = async (session, isNewLogin = false) => {
    const nextUser = session?.user ?? null
    const nextUserId = nextUser?.id ?? null
    const previousUserId = activeUserId.current
    const isInitialAuth = !hasInitializedAuth.current
    const userChanged = previousUserId !== nextUserId

    setUser(nextUser)

    if (isInitialAuth || userChanged || isNewLogin) {
      const transitionId = cartTransitionId.current + 1
      cartTransitionId.current = transitionId
      setCartReady(false)
      hasInitializedAuth.current = true
      activeUserId.current = nextUserId

      if (!nextUserId) {
        setCartItems(getSavedGuestCartItems())
        setCartReady(true)
        setAuthInitialized(true)
        return
      }

      const restoredCart = await loadCartFromSupabase(nextUserId)
      if (cartTransitionId.current !== transitionId) return

      const accountCart = restoredCart.length > 0
        ? restoredCart
        : getSavedCartItems(nextUserId)
      const guestCart = previousUserId ? [] : getSavedGuestCartItems()
      setCartItems(mergeCartItems(accountCart, guestCart))
      setCartReady(true)
      setAuthInitialized(true)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return

      const session = data.session
      void applyAuthSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const wasLoggedOut = !activeUserId.current

        void applyAuthSession(
          session,
          event === 'SIGNED_IN' && wasLoggedOut
        )

        if (event === 'SIGNED_IN' && wasLoggedOut) {
          setCurrentView('home')
        }

        if (event === 'PASSWORD_RECOVERY') {
          isRecoveringPassword.current = true
          setAuthMode('reset')
          setCurrentView('account')
        }

        if (event === 'SIGNED_OUT') {
          setAuthMode('login')
          setCurrentView('account')
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [setCurrentView])

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
    phone: deliveryDetails.phone.trim(),
    address_line_1: deliveryDetails.addressLine1.trim(),
    address_line_2: deliveryDetails.addressLine2.trim(),
    city: deliveryDetails.city.trim(),
    postal_code: deliveryDetails.postalCode.trim()
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
    let message = error instanceof Error ? error.message : 'Could not start payment. Please try again.'
    const response = error && typeof error === 'object' && 'context' in error
      ? error.context
      : null

    if (response instanceof Response) {
      try {
        const body = await response.clone().json()
        if (typeof body?.error === 'string') message = body.error
      } catch (responseError) {
        console.error('Could not read the payment function error response:', responseError)
      }
    }

    setCheckoutError(message)
  } finally {
    setIsSubmittingOrder(false)
  }
}

  const totalItems = cartItems.reduce((sum, item) => sum + Math.max(0, Math.trunc(asNumber(item.quantity, 0))), 0)
  const displayName = typeof user?.user_metadata?.name === 'string'
    ? user.user_metadata.name.trim()
    : ''

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

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
  }, [paymentReference, setCurrentView, user])

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
              isRecoveringPassword.current = false
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
        setCheckoutError('')
        setCurrentView('checkout')
      }}
    />
  )

  const checkoutPage = (
    <Checkout
      items={cartItems}
      email={user?.email ?? ''}
      onBack={() => setCurrentView('cart')}
      onPlaceOrder={placeOrder}
      isSubmitting={isSubmittingOrder}
      error={checkoutError}
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
        <div className="brand-wrap">
          <div className="brand-mark">N</div>
          <span>NeonCart</span>
        </div>

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

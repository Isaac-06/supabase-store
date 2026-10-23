import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!
const appOrigin = Deno.env.get('APP_ORIGIN')?.replace(/\/$/, '')

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': appOrigin ?? '',
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Please provide a valid ${label}.`)
  }
  return value.trim()
}

async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization) throw new Error('You must be signed in to pay.')

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user?.email) throw new Error('Your session is invalid. Please sign in again.')
  return user
}

async function initializePayment(request: Request, body: Record<string, unknown>) {
  const user = await getAuthenticatedUser(request)
  if (!appOrigin) throw new Error('The payment return URL has not been configured.')

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    throw new Error('Your cart is empty or contains too many items.')
  }

  const requestedItems = body.items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Your cart contains an invalid item.')
    const { product_id: productId, quantity } = item as Record<string, unknown>
    if (typeof productId !== 'number' || !Number.isSafeInteger(productId) || productId < 1) {
      throw new Error('Your cart contains an invalid product.')
    }
    if (
      typeof quantity !== 'number'
      || !Number.isSafeInteger(quantity)
      || quantity < 1
      || quantity > 99
    ) {
      throw new Error('Each product quantity must be between 1 and 99.')
    }
    return { productId, quantity }
  })

  const delivery = body.delivery_address
  if (!delivery || typeof delivery !== 'object') throw new Error('Delivery details are required.')
  const address = delivery as Record<string, unknown>
  const shippingAddress = {
    customer_name: getRequiredText(address.customer_name, 'name', 120),
    phone: getRequiredText(address.phone, 'phone number', 40),
    address_line_1: getRequiredText(address.address_line_1, 'address', 200),
    address_line_2: typeof address.address_line_2 === 'string'
      ? address.address_line_2.trim().slice(0, 200)
      : '',
    city: getRequiredText(address.city, 'city', 100),
    postal_code: getRequiredText(address.postal_code, 'postal code', 24),
    country: getRequiredText(address.country, 'country', 100),
  }

  const productIds = [...new Set(requestedItems.map((item) => item.productId))]
  const { data: products, error: productsError } = await admin
    .from('products')
    .select('id, name, price, image')
    .in('id', productIds)
  if (productsError) throw new Error('Could not validate products for this order.')
  if (!products || products.length !== productIds.length) {
    throw new Error('One or more products are no longer available.')
  }

  const productsById = new Map(products.map((product) => [Number(product.id), product]))
  let amountKobo = 0
  const orderItems = requestedItems.map(({ productId, quantity }) => {
    const product = productsById.get(productId)
    const price = Number(product?.price)
    if (!product || !Number.isFinite(price) || price <= 0) {
      throw new Error('One or more products have an invalid price.')
    }
    const unitAmountKobo = Math.round(price * 100)
    if (!Number.isSafeInteger(unitAmountKobo) || unitAmountKobo < 1) {
      throw new Error('One or more product prices are invalid.')
    }
    amountKobo += unitAmountKobo * quantity
    return {
      product_id: productId,
      name: product.name,
      price,
      quantity,
      image: product.image,
    }
  })
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 1) {
    throw new Error('The order total is invalid.')
  }

  const reference = `neoncart-${crypto.randomUUID()}`
  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      customer_email: user.email,
      customer_name: shippingAddress.customer_name,
      phone: shippingAddress.phone,
      shipping_address: shippingAddress,
      items: orderItems,
      total_amount: amountKobo / 100,
      status: 'pending',
      payment_reference: reference,
      payment_currency: 'NGN',
      payment_amount_kobo: amountKobo,
    })
    .select('id')
    .single()
  if (orderError) throw new Error('Could not create your pending order.')

  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountKobo,
      currency: 'NGN',
      reference,
      callback_url: `${appOrigin}/?payment=paystack`,
      metadata: { order_id: order.id },
    }),
  })
  const result = await paystackResponse.json()
  if (!paystackResponse.ok || !result.status || !result.data?.authorization_url) {
    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)
      .eq('status', 'pending')
    if (updateError) console.error('Could not mark failed payment initialization:', updateError)
    throw new Error('Paystack could not start your payment. Please try again.')
  }

  return { authorization_url: result.data.authorization_url }
}

async function verifyPayment(request: Request, body: Record<string, unknown>) {
  const user = await getAuthenticatedUser(request)
  const reference = getRequiredText(body.reference, 'payment reference', 100)
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, user_id, customer_name, total_amount, status, payment_reference, payment_currency, payment_amount_kobo')
    .eq('payment_reference', reference)
    .eq('user_id', user.id)
    .maybeSingle()
  if (orderError) throw new Error('Could not find the order for this payment.')
  if (!order) throw new Error('No order was found for this payment reference.')
  if (order.status === 'cancelled') throw new Error('This order is no longer active.')

  const paystackResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
  )
  const result = await paystackResponse.json()
  if (!paystackResponse.ok || !result.status) {
    throw new Error('Paystack could not verify this payment yet. Please try again.')
  }

  const transaction = result.data
  if (transaction.status !== 'success') {
    return { paid: false, message: 'Payment was not completed. You can try checkout again.' }
  }
  if (
    transaction.amount !== order.payment_amount_kobo
    || transaction.currency !== order.payment_currency
  ) {
    throw new Error('The payment amount or currency does not match this order.')
  }

  if (order.status !== 'paid') {
    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
    if (updateError) throw new Error('Payment was verified, but the order status could not be updated.')
  }

  return {
    paid: true,
    order: {
      order_id: order.id,
      customer_name: order.customer_name,
      total_amount: order.total_amount,
      status: 'paid',
    },
  }
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function handleWebhook(request: Request) {
  const signature = request.headers.get('x-paystack-signature')
  if (!signature) return jsonResponse({ error: 'Missing webhook signature.' }, 401)

  const rawBody = await request.text()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(paystackSecretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expectedSignature = bytesToHex(digest)
  const receivedSignature = signature.toLowerCase()
  let signatureDifference = expectedSignature.length ^ receivedSignature.length
  for (let index = 0; index < expectedSignature.length; index += 1) {
    signatureDifference |= expectedSignature.charCodeAt(index) ^ (receivedSignature.charCodeAt(index) || 0)
  }
  if (signatureDifference !== 0) {
    return jsonResponse({ error: 'Invalid webhook signature.' }, 401)
  }

  const event = JSON.parse(rawBody)
  if (event.event !== 'charge.success') return jsonResponse({ received: true })

  const transaction = event.data
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, payment_amount_kobo, payment_currency')
    .eq('payment_reference', transaction.reference)
    .maybeSingle()
  if (orderError) throw new Error('Could not match webhook to an order.')
  if (!order) return jsonResponse({ received: true, matched: false })
  if (
    transaction.status !== 'success'
    || transaction.amount !== order.payment_amount_kobo
    || transaction.currency !== order.payment_currency
  ) {
    return jsonResponse({ error: 'Webhook payment does not match the order.' }, 400)
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', order.id)
    .eq('status', 'pending')
  if (updateError) throw new Error('Could not update order from payment webhook.')
  return jsonResponse({ received: true })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const origin = request.headers.get('Origin')
  if (origin && origin.replace(/\/$/, '') !== appOrigin) {
    return jsonResponse({ error: 'Origin is not allowed.' }, 403)
  }

  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !paystackSecretKey) {
      throw new Error('Payment service is not fully configured.')
    }
    if (request.headers.has('x-paystack-signature')) return await handleWebhook(request)

    const body = await request.json()
    if (!body || typeof body !== 'object') throw new Error('Invalid request.')
    if (body.action === 'initialize') return jsonResponse(await initializePayment(request, body))
    if (body.action === 'verify') return jsonResponse(await verifyPayment(request, body))
    return jsonResponse({ error: 'Unsupported payment action.' }, 400)
  } catch (error) {
    console.error('Paystack payment request failed:', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'An unexpected payment error occurred.',
    }, 400)
  }
})

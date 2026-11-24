import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
const appOrigin = Deno.env.get("APP_ORIGIN");
const currency = "NGN";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  ...(appOrigin ? { "Access-Control-Allow-Origin": appOrigin } : {}),
};

type CartRequestItem = {
  product_id: number | string;
  quantity: number;
  customization_notes?: string;
};

type DeliveryAddress = {
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  postal_code: string;
};

class PaymentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new PaymentError(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new PaymentError(`${field} is required and must be at most ${maxLength} characters.`);
  }
  return trimmed;
}

function validateDeliveryAddress(value: unknown): DeliveryAddress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PaymentError("Delivery details are required.");
  }
  const address = value as Record<string, unknown>;
  const phone = requiredString(address.phone, "Phone number", 40);
  const phoneDigits = phone.replace(/\D/g, "");
  if (!/^[+()\d\s.-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new PaymentError("Enter a phone number with 7 to 15 digits.");
  }

  return {
    phone,
    address_line_1: requiredString(address.address_line_1, "Address", 200),
    address_line_2: typeof address.address_line_2 === "string"
      ? address.address_line_2.trim().slice(0, 200)
      : "",
    city: requiredString(address.city, "City", 100),
    postal_code: requiredString(address.postal_code, "Postal code", 24),
  };
}

function validateCartItems(value: unknown): CartRequestItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PaymentError("Your cart must contain at least one product.");
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new PaymentError("The cart contains an invalid product.");
    }
    const item = entry as Record<string, unknown>;
    const productId = item.product_id;
    const validId = (typeof productId === "number" && Number.isSafeInteger(productId) && productId > 0) ||
      (typeof productId === "string" && /^[1-9]\d{0,18}$/.test(productId) && BigInt(productId) <= 9_223_372_036_854_775_807n);
    if (!validId) throw new PaymentError("The cart contains an invalid product.");

    const quantity = item.quantity;
    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new PaymentError("Product quantities must be positive whole numbers.");
    }
    const notes = item.customization_notes ?? "";
    if (typeof notes !== "string" || notes.length > 500) {
      throw new PaymentError("Customization notes must be 500 characters or fewer.");
    }

    return {
      product_id: productId as number | string,
      quantity,
      customization_notes: notes.trim(),
    };
  });
}

function validateExpectedItems(value: unknown, items: CartRequestItem[]) {
  if (!Array.isArray(value) || value.length !== items.length) {
    throw new PaymentError("Your order changed. Review the current prices before paying.", 409);
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new PaymentError("Your order changed. Review the current prices before paying.", 409);
    }

    const expected = entry as Record<string, unknown>;
    const price = expected.price;
    const quantity = expected.quantity;
    if (
      String(expected.product_id) !== String(items[index].product_id) ||
      quantity !== items[index].quantity ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isSafeInteger(Math.round(price * 100))
    ) {
      throw new PaymentError("Your order changed. Review the current prices before paying.", 409);
    }

    return Math.round(price * 100);
  });
}

async function priceCartItems(items: CartRequestItem[], admin: ReturnType<typeof getAdminClient>) {
  const productIds = [...new Set(items.map((item) => String(item.product_id)))];
  const { data: products, error: productError } = await admin
    .from("products")
    .select("id, name, price, image")
    .in("id", productIds);
  if (productError) throw new Error("Could not load product prices. Please try again.");
  if (!products || products.length !== productIds.length) {
    throw new PaymentError("One or more products in your cart are no longer available.");
  }

  const productById = new Map(products.map((product) => [String(product.id), product]));
  const calculatedItems = items.map((item) => {
    const product = productById.get(String(item.product_id));
    if (!product) {
      throw new PaymentError("One or more products in your cart are no longer available.");
    }

    const price = Number(product.price);
    const priceKobo = Math.round(price * 100);
    if (!Number.isFinite(price) || price < 0 || !Number.isSafeInteger(priceKobo)) {
      throw new Error("A product has an invalid price.");
    }
    const lineTotalKobo = priceKobo * item.quantity;
    if (!Number.isSafeInteger(lineTotalKobo)) {
      throw new PaymentError("The order total is too large.");
    }

    return {
      lineTotalKobo,
      orderItem: {
        product_id: product.id,
        name: product.name,
        price: priceKobo / 100,
        quantity: item.quantity,
        customization_notes: item.customization_notes,
      },
      quoteItem: {
        product_id: product.id,
        name: product.name,
        image: product.image || "",
        price: priceKobo / 100,
        quantity: item.quantity,
        customization_notes: item.customization_notes,
      },
    };
  });

  const totalKobo = calculatedItems.reduce((sum, item) => sum + item.lineTotalKobo, 0);
  if (!Number.isSafeInteger(totalKobo) || totalKobo < 1 || totalKobo > 9_999_999_999) {
    throw new PaymentError("The order total must be positive and within the supported limit.");
  }

  return {
    totalKobo,
    orderItems: calculatedItems.map((item) => item.orderItem),
    quoteItems: calculatedItems.map((item) => item.quoteItem),
  };
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new PaymentError("You must be signed in to make a payment.", 401);
  return match[1];
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureStringEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function isValidPaystackSignature(body: string, signature: string) {
  if (!paystackSecretKey || !/^[a-f\d]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(paystackSecretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return secureStringEquals(toHex(new Uint8Array(digest)), signature.toLowerCase());
}

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("The payment service is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAuthenticatedUser(req: Request, admin: ReturnType<typeof getAdminClient>) {
  const { data, error } = await admin.auth.getUser(getBearerToken(req));
  if (error || !data.user) {
    throw new PaymentError("Your session is invalid. Please sign in again.", 401);
  }
  return data.user;
}

async function initializePayment(body: Record<string, unknown>, user: {
  id: string;
  email?: string;
  user_metadata?: { name?: unknown };
}, admin: ReturnType<typeof getAdminClient>) {
  if (!paystackSecretKey) throw new Error("The payment service is not configured.");
  if (!appOrigin) throw new Error("The payment callback URL is not configured.");
  if (!user.email) throw new PaymentError("Your account must have an email address to pay.");

  const items = validateCartItems(body.items);
  const deliveryAddress = validateDeliveryAddress(body.delivery_address);
  const pricedOrder = await priceCartItems(items, admin);
  const expectedPrices = validateExpectedItems(body.expected_items, items);
  if (pricedOrder.orderItems.some((item, index) =>
    Math.round(item.price * 100) !== expectedPrices[index]
  )) {
    throw new PaymentError("Product prices changed. Review the updated total before paying.", 409);
  }
  const { totalKobo, orderItems } = pricedOrder;

  const reference = crypto.randomUUID();
  const customerName = typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
    ? user.user_metadata.name.trim().slice(0, 120)
    : "Customer";
  const { data: order, error: insertError } = await admin
    .from("orders")
    .insert({
      user_id: user.id,
      customer_email: user.email,
      customer_name: customerName,
      phone: deliveryAddress.phone,
      shipping_address: deliveryAddress,
      items: orderItems,
      total_amount: (totalKobo / 100).toFixed(2),
      status: "pending",
      payment_reference: reference,
      payment_currency: currency,
      payment_amount_kobo: totalKobo,
    })
    .select("id")
    .single();
  if (insertError) throw new Error("Could not create your order. Please try again.");

  const { error: deliveryDetailsError } = await admin
    .from("order_delivery_details")
    .insert({
      order_id: order.id,
      user_id: user.id,
      phone: deliveryAddress.phone,
      address_line_1: deliveryAddress.address_line_1,
      address_line_2: deliveryAddress.address_line_2,
      city: deliveryAddress.city,
      postal_code: deliveryAddress.postal_code,
    });
  if (deliveryDetailsError) {
    console.error("Could not save order delivery details:", deliveryDetailsError);
    const { error: cancelError } = await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (cancelError) console.error("Could not cancel order without delivery details:", cancelError);
    throw new PaymentError("Could not save your delivery details. Please try again.", 500);
  }

  const callbackUrl = new URL("/", appOrigin);
  callbackUrl.searchParams.set("payment", "paystack");

  let paystackResponse: Response;
  try {
    paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: totalKobo,
        currency,
        reference,
        callback_url: callbackUrl.toString(),
        metadata: { order_id: order.id },
      }),
    });
  } catch (error) {
    console.error("Could not reach Paystack:", error);
    throw new PaymentError("Could not connect to Paystack. Please try again.", 502);
  }

  const result = await paystackResponse.json().catch(() => null);
  if (
    !paystackResponse.ok ||
    result?.status !== true ||
    !result?.data?.authorization_url ||
    result?.data?.reference !== reference
  ) {
    console.error("Paystack initialization failed:", {
      status: paystackResponse.status,
      message: result?.message,
    });
    const { error: updateError } = await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (updateError) console.error("Could not cancel uninitialized order:", updateError);
    throw new PaymentError("Paystack could not start the payment. Please try again.", 502);
  }

  return { authorization_url: result.data.authorization_url, reference };
}

async function quotePayment(body: Record<string, unknown>, admin: ReturnType<typeof getAdminClient>) {
  const items = validateCartItems(body.items);
  const pricedOrder = await priceCartItems(items, admin);
  return {
    items: pricedOrder.quoteItems,
    total_amount: pricedOrder.totalKobo / 100,
    currency,
  };
}

async function markOrderPaid(admin: ReturnType<typeof getAdminClient>, reference: string) {
  const { data: order, error: findError } = await admin
    .from("orders")
    .select("id, user_id, customer_name, total_amount, items, status, payment_amount_kobo, payment_currency")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (findError) throw new Error("Could not find the order for this payment.");
  if (!order) throw new PaymentError("No order matches this payment reference.", 404);
  if (order.status === "paid") return order;
  if (order.status !== "pending") {
    throw new PaymentError("This order is not awaiting payment.", 409);
  }

  const { data: updatedOrder, error: updateError } = await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id, user_id, customer_name, total_amount, items, status")
    .maybeSingle();
  if (updateError) throw new Error("Could not update the order payment status.");
  if (updatedOrder) return updatedOrder;

  const { data: latestOrder, error: latestError } = await admin
    .from("orders")
    .select("id, user_id, customer_name, total_amount, items, status")
    .eq("id", order.id)
    .single();
  if (latestError || latestOrder.status !== "paid") {
    throw new Error("The order payment status could not be confirmed.");
  }
  return latestOrder;
}

async function verifyPayment(body: Record<string, unknown>, user: {
  id: string;
}, admin: ReturnType<typeof getAdminClient>) {
  if (!paystackSecretKey) throw new Error("The payment service is not configured.");
  const reference = requiredString(body.reference, "Payment reference", 100);
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, user_id, customer_name, total_amount, items, status, payment_amount_kobo, payment_currency")
    .eq("payment_reference", reference)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError) throw new Error("Could not find your order.");
  if (!order) throw new PaymentError("No order matches this payment reference.", 404);
  if (order.status === "paid") {
    return {
      paid: true,
      order: {
        order_id: order.id,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        items: order.items,
      },
    };
  }
  if (order.status !== "pending") {
    throw new PaymentError("This order is not awaiting payment.", 409);
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== true) {
    console.error("Paystack verification failed:", result);
    throw new PaymentError("Could not verify payment with Paystack. Please try again.", 502);
  }

  const transaction = result.data;
  if (
    transaction?.reference !== reference ||
    transaction?.status !== "success" ||
    transaction.amount !== order.payment_amount_kobo ||
    transaction.currency !== order.payment_currency ||
    transaction.currency !== currency
  ) {
    return { paid: false, message: "Payment has not been completed or could not be confirmed." };
  }

  const paidOrder = await markOrderPaid(admin, reference);
  return {
    paid: true,
    order: {
      order_id: paidOrder.id,
      customer_name: paidOrder.customer_name,
      total_amount: paidOrder.total_amount,
      items: paidOrder.items,
    },
  };
}

async function handleWebhook(req: Request, rawBody: string, admin: ReturnType<typeof getAdminClient>) {
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!(await isValidPaystackSignature(rawBody, signature))) {
    return jsonResponse({ error: "Invalid webhook signature." }, 401);
  }

  const payload = JSON.parse(rawBody);
  if (payload.event !== "charge.success") return jsonResponse({ received: true });

  const transaction = payload.data;
  if (
    !transaction ||
    typeof transaction.reference !== "string" ||
    transaction.status !== "success"
  ) {
    return jsonResponse({ error: "Invalid successful-payment event." }, 400);
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("payment_amount_kobo, payment_currency")
    .eq("payment_reference", transaction.reference)
    .maybeSingle();
  if (orderError) throw new Error("Could not find the order for this webhook.");
  if (!order) return jsonResponse({ error: "No order matches this payment reference." }, 404);
  if (
    transaction.amount !== order.payment_amount_kobo ||
    transaction.currency !== order.payment_currency ||
    transaction.currency !== currency
  ) {
    return jsonResponse({ error: "Payment amount or currency does not match the order." }, 400);
  }

  await markOrderPaid(admin, transaction.reference);
  return jsonResponse({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin && appOrigin && origin !== appOrigin) {
      return jsonResponse({ error: "Origin is not allowed." }, 403);
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const origin = req.headers.get("origin");
  if (origin && appOrigin && origin !== appOrigin) {
    return jsonResponse({ error: "Origin is not allowed." }, 403);
  }

  try {
    const admin = getAdminClient();
    const rawBody = await req.text();
    if (req.headers.has("x-paystack-signature")) {
      return await handleWebhook(req, rawBody, admin);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return jsonResponse({ error: "Invalid request body." }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const user = await getAuthenticatedUser(req, admin);
    if (body.action === "quote") {
      return jsonResponse(await quotePayment(body, admin));
    }
    if (body.action === "initialize") {
      return jsonResponse(await initializePayment(body, user, admin));
    }
    if (body.action === "verify") {
      return jsonResponse(await verifyPayment(body, user, admin));
    }
    return jsonResponse({ error: "Unsupported payment action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected payment error.";
    console.error("Paystack payment request failed:", error);
    const status = error instanceof PaymentError ? error.status : 500;
    return jsonResponse({ error: message }, status);
  }
});

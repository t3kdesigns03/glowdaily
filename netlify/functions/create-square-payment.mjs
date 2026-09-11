/**
 * create-square-payment — GlowDaily
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Square hosted "Quick Pay" payment link for an order total and returns
 * its URL. The customer pays on Square's own PCI-compliant page — no card data
 * ever touches this site or this function.
 *
 * FAIL-OPEN: if Square env vars aren't set (e.g. before real keys are added), this
 * returns 200 { configured:false } so the front-end silently falls back to the
 * existing manual "we'll send you a Square link" note. It NEVER 500s the order.
 *
 * ENV (set in Netlify → Site configuration → Environment variables — never in the
 * repo, never NEXT_PUBLIC / client-exposed):
 *   SQUARE_ACCESS_TOKEN   — Square API access token (server secret)
 *   SQUARE_LOCATION_ID    — the Square location that receives the payment
 *   SQUARE_ENVIRONMENT    — "sandbox" (default) or "production"
 *   SQUARE_API_VERSION    — optional, defaults to a known-good version
 *
 * Request  (POST JSON): { orderId, amountCents, description?, redirectUrl? }
 * Response (200 JSON):  { configured:true, url, paymentLinkId }
 *                       { configured:false, reason }        // graceful fallback
 */

const API_VERSION_DEFAULT = "2025-01-23";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      // Same-origin in production; permissive here so a preview host can call it.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { configured: false, reason: "POST only" });

  const token   = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  const location = (process.env.SQUARE_LOCATION_ID || "").trim();
  const envName = (process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();
  const apiVersion = (process.env.SQUARE_API_VERSION || API_VERSION_DEFAULT).trim();

  // Not configured yet → graceful fallback, not an error.
  if (!token || !location) {
    return json(200, { configured: false, reason: "Square not configured" });
  }

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch { /* keep {} */ }

  const orderId = String(payload.orderId || "").slice(0, 40) || `GD-${Date.now().toString(36)}`;
  const amountCents = Math.round(Number(payload.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return json(400, { configured: true, error: "invalid amountCents" });
  }
  const name = String(payload.description || `GlowDaily order ${orderId}`).slice(0, 255);
  const redirectUrl = typeof payload.redirectUrl === "string" ? payload.redirectUrl : undefined;

  const base = envName === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  const body = {
    idempotency_key: `gd-${orderId}`.slice(0, 45),
    quick_pay: {
      name,
      price_money: { amount: amountCents, currency: "USD" },
      location_id: location,
    },
    ...(redirectUrl ? { checkout_options: { redirect_url: redirectUrl } } : {}),
    payment_note: orderId,
  };

  try {
    const res = await fetch(`${base}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Square-Version": apiVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.payment_link?.url) {
      const detail = data?.errors?.[0]?.detail || `Square returned ${res.status}`;
      return json(502, { configured: true, error: detail });
    }
    return json(200, {
      configured: true,
      url: data.payment_link.url,
      paymentLinkId: data.payment_link.id || null,
    });
  } catch (e) {
    return json(502, { configured: true, error: "Square request failed" });
  }
};

/**
 * Shared Shopify customer helpers (server-only).
 * Used by the lead-capture endpoint and the consent backfill endpoint.
 */

export const SHOPIFY_API_VERSION = "2025-01"

export type ConsentState = "subscribed" | "pending" | "not_subscribed" | "unsubscribed"

export interface ShopifyCustomer {
  id: number
  email?: string
  tags?: string
  email_marketing_consent?: {
    state?: ConsentState
    opt_in_level?: string
    consent_updated_at?: string | null
  } | null
}

export function normalizeShopifyStore(store: string) {
  return store
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com$/i, "")
}

export function shopifyHeaders(accessToken: string) {
  return {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  }
}

export async function findCustomerByEmail(
  shopName: string,
  accessToken: string,
  email: string,
): Promise<ShopifyCustomer | null> {
  const headers = shopifyHeaders(accessToken)
  const lower = email.toLowerCase()
  for (const q of [`email:${lower}`, `email:"${lower}"`, lower]) {
    const url = `https://${shopName}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers })
    if (!r.ok) continue
    const j = (await r.json()) as { customers?: ShopifyCustomer[] }
    const match = j.customers?.find((c) => (c.email || "").toLowerCase() === lower)
    if (match) return match
  }
  return null
}

export async function getCustomer(
  shopName: string,
  accessToken: string,
  customerId: string | number,
): Promise<ShopifyCustomer | null> {
  const r = await fetch(
    `https://${shopName}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`,
    { headers: shopifyHeaders(accessToken) },
  )
  if (!r.ok) return null
  const j = (await r.json()) as { customer?: ShopifyCustomer }
  return j.customer ?? null
}

/**
 * Write email marketing consent on an existing customer and return the state
 * Shopify actually stored (never assume the write succeeded).
 */
export async function setEmailMarketingConsent(
  shopName: string,
  accessToken: string,
  customerId: string | number,
  opts: {
    state: "subscribed" | "pending"
    optInLevel: "single_opt_in" | "confirmed_opt_in"
    consentUpdatedAt: string
    tags?: string
  },
): Promise<{ ok: boolean; state: ConsentState | null; error?: string }> {
  const body: Record<string, unknown> = {
    id: customerId,
    accepts_marketing: true,
    accepts_marketing_updated_at: opts.consentUpdatedAt,
    marketing_opt_in_level: opts.optInLevel,
    email_marketing_consent: {
      state: opts.state,
      opt_in_level: opts.optInLevel,
      consent_updated_at: opts.consentUpdatedAt,
    },
  }
  if (opts.tags !== undefined) body["tags"] = opts.tags

  const url = `https://${shopName}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`
  const init = {
    method: "PUT",
    headers: shopifyHeaders(accessToken),
    body: JSON.stringify({ customer: body }),
  }
  let r = await fetch(url, init)
  // Shopify throttles at 2 calls/second — back off and retry instead of losing the write.
  for (let attempt = 0; r.status === 429 && attempt < 4; attempt++) {
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)))
    r = await fetch(url, init)
  }
  if (!r.ok) {
    const error = await r.text().catch(() => "")
    return { ok: false, state: null, error: `${r.status} ${error}`.trim() }
  }
  const j = (await r.json()) as { customer?: ShopifyCustomer }
  const state = j.customer?.email_marketing_consent?.state ?? null
  return { ok: state === opts.state, state }
}

export function mergeTags(existing: string | undefined, tag: string): string {
  const tags = (existing || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  if (!tags.includes(tag)) tags.push(tag)
  return tags.join(", ")
}

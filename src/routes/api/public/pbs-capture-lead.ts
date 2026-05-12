import { createFileRoute } from "@tanstack/react-router"
import { supabaseAdmin } from "@/integrations/supabase/client.server"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const API_VERSION = "2025-01"

function normalizeShopifyStore(store: string) {
  return store
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com$/i, "")
}

async function upsertShopifyLead(
  shopName: string,
  accessToken: string,
  email: string,
): Promise<string | null> {
  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  }
  try {
    // Look for an existing customer with this email.
    const searchUrl = `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers/search.json?query=${encodeURIComponent(`email:${email}`)}`
    const searchRes = await fetch(searchUrl, { headers })
    if (searchRes.ok) {
      const sj = (await searchRes.json()) as { customers?: Array<{ id: number; tags?: string }> }
      const existing = sj.customers?.[0]
      if (existing) {
        // Make sure pbs-lead tag is present.
        const tags = (existing.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
        if (!tags.includes("pbs-lead")) {
          tags.push("pbs-lead")
          await fetch(
            `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers/${existing.id}.json`,
            {
              method: "PUT",
              headers,
              body: JSON.stringify({ customer: { id: existing.id, tags: tags.join(", ") } }),
            },
          )
        }
        return String(existing.id)
      }
    } else {
      console.warn("Shopify customer search failed", searchRes.status, await searchRes.text().catch(() => ""))
    }

    // Create a new customer.
    const createRes = await fetch(
      `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers.json`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer: {
            email,
            tags: "pbs-lead",
            accepts_marketing: false,
            email_marketing_consent: { state: "not_subscribed", opt_in_level: "single_opt_in" },
          },
        }),
      },
    )
    if (!createRes.ok) {
      console.warn("Shopify customer create failed", createRes.status, await createRes.text().catch(() => ""))
      return null
    }
    const cj = (await createRes.json()) as { customer?: { id: number } }
    return cj.customer?.id ? String(cj.customer.id) : null
  } catch (err) {
    console.warn("upsertShopifyLead error", err)
    return null
  }
}

export const Route = createFileRoute("/api/public/pbs-capture-lead")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 200, headers: corsHeaders }),
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json().catch(() => ({}))
          const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
          if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 255) {
            return Response.json({ error: "Invalid email" }, { status: 400, headers: corsHeaders })
          }

          const productType =
            typeof body?.productType === "string" && body.productType.length <= 64
              ? body.productType
              : null
          const stepReached =
            typeof body?.stepReached === "string" && body.stepReached.length <= 64
              ? body.stepReached
              : null
          const lastConfig =
            body?.lastConfig && typeof body.lastConfig === "object" ? body.lastConfig : null

          // 1. Best-effort: create / tag Shopify customer.
          let shopifyCustomerId: string | null = null
          const SHOPIFY_STORE = process.env.SHOPIFY_STORE
          const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
          if (SHOPIFY_STORE && SHOPIFY_ACCESS_TOKEN) {
            shopifyCustomerId = await upsertShopifyLead(
              normalizeShopifyStore(SHOPIFY_STORE),
              SHOPIFY_ACCESS_TOKEN,
              rawEmail,
            )
          }

          // 2. Upsert into quote_leads.
          const { error } = await supabaseAdmin
            .from("quote_leads")
            .upsert(
              {
                email: rawEmail,
                product_type: productType,
                step_reached: stepReached,
                last_config: lastConfig,
                shopify_customer_id: shopifyCustomerId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "email" },
            )
          if (error) {
            console.warn("quote_leads upsert error", error)
            return Response.json(
              { ok: false, savedShopify: !!shopifyCustomerId, error: error.message },
              { status: 500, headers: corsHeaders },
            )
          }

          return Response.json(
            { ok: true, savedShopify: !!shopifyCustomerId },
            { headers: corsHeaders },
          )
        } catch (err: any) {
          console.error("pbs-capture-lead error", err)
          return Response.json(
            { error: "Internal error", detail: err?.message },
            { status: 500, headers: corsHeaders },
          )
        }
      },
    },
  },
})

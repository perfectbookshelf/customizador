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
  const findExisting = async (): Promise<{ id: number; tags?: string } | null> => {
    const queries = [
      `email:${email}`,
      `email:"${email}"`,
      email,
    ]
    for (const q of queries) {
      const url = `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers/search.json?query=${encodeURIComponent(q)}`
      const r = await fetch(url, { headers })
      if (!r.ok) continue
      const j = (await r.json()) as { customers?: Array<{ id: number; tags?: string; email?: string }> }
      const match = j.customers?.find((c) => (c.email || "").toLowerCase() === email)
      if (match) return match
    }
    return null
  }
  try {
    const existing = await findExisting()
    if (existing) {
      // Make sure pbs-lead tag is present.
      const tags = (existing.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      const needsTag = !tags.includes("pbs-lead")
      if (needsTag) tags.push("pbs-lead")
      const nowIso = new Date().toISOString()
      await fetch(
        `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers/${existing.id}.json`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            customer: {
              id: existing.id,
              tags: tags.join(", "),
              accepts_marketing: true,
              accepts_marketing_updated_at: nowIso,
              marketing_opt_in_level: "single_opt_in",
              email_marketing_consent: {
                state: "subscribed",
                opt_in_level: "single_opt_in",
                consent_updated_at: nowIso,
              },
            },
          }),
        },
      )
      return String(existing.id)
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
            accepts_marketing: true,
            accepts_marketing_updated_at: new Date().toISOString(),
            marketing_opt_in_level: "single_opt_in",
            email_marketing_consent: {
              state: "subscribed",
              opt_in_level: "single_opt_in",
              consent_updated_at: new Date().toISOString(),
            },
          },
        }),
      },
    )
    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "")
      console.warn("Shopify customer create failed", createRes.status, errText)
      // 422 "already taken" → search index lagged. Retry lookup.
      if (createRes.status === 422 && /already.*taken/i.test(errText)) {
        await new Promise((r) => setTimeout(r, 600))
        const retry = await findExisting()
        if (retry) return String(retry.id)
      }
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

          // 2. Upsert into quote_leads. Only set shopify_customer_id when we
          // actually have one — never overwrite an existing id with null.
          const row = {
            email: rawEmail,
            product_type: productType,
            step_reached: stepReached,
            last_config: lastConfig as never,
            updated_at: new Date().toISOString(),
            ...(shopifyCustomerId ? { shopify_customer_id: shopifyCustomerId } : {}),
          }
          const { error } = await supabaseAdmin
            .from("quote_leads")
            .upsert(row, { onConflict: "email" })
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

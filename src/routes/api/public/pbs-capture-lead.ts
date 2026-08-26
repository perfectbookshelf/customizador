import { createFileRoute } from "@tanstack/react-router"
import { supabaseAdmin } from "@/integrations/supabase/client.server"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const API_VERSION = "2025-01"

// Opt-in mode: "double" enables Shopify's confirmation email flow (leads land
// as "pending" until they click the confirm link). Defaults to "single" so
// existing behavior is preserved unless MARKETING_OPT_IN_MODE=double is set.
type OptInMode = "single" | "double"
function resolveOptInMode(): OptInMode {
  const raw = process.env.MARKETING_OPT_IN_MODE
  console.log("[pbs-capture-lead] MARKETING_OPT_IN_MODE raw value:", JSON.stringify(raw))
  if (!raw || raw.trim() === "") {
    throw new Error("MARKETING_OPT_IN_MODE is not configured. Set it to 'single' or 'double'.")
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized !== "single" && normalized !== "double") {
    throw new Error(`Invalid MARKETING_OPT_IN_MODE value: ${JSON.stringify(raw)}. Must be 'single' or 'double'.`)
  }
  return normalized
}

interface MarketingConsent {
  accepts_marketing: true // invariant — always true at capture time
  opt_in_level: "single_opt_in" | "confirmed_opt_in"
  state: "subscribed" | "pending"
  consent_updated_at: string
}

function buildMarketingConsent(mode: OptInMode): MarketingConsent {
  const consent: MarketingConsent = {
    accepts_marketing: true,
    opt_in_level: mode === "double" ? "confirmed_opt_in" : "single_opt_in",
    state: mode === "double" ? "pending" : "subscribed",
    consent_updated_at: new Date().toISOString(),
  }
  // Runtime guard: never send a payload without accepts_marketing=true.
  if (consent.accepts_marketing !== true) {
    throw new Error("Marketing consent invariant violated: accepts_marketing must be true")
  }
  return consent
}

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
  consent: MarketingConsent,
): Promise<string | null> {
  const headers = {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  }
  const findExisting = async (): Promise<{ id: number; tags?: string } | null> => {
    const queries = [`email:${email}`, `email:"${email}"`, email]
    for (const q of queries) {
      const url = `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers/search.json?query=${encodeURIComponent(q)}`
      const r = await fetch(url, { headers })
      if (!r.ok) continue
      const j = (await r.json()) as {
        customers?: Array<{ id: number; tags?: string; email?: string }>
      }
      const match = j.customers?.find((c) => (c.email || "").toLowerCase() === email)
      if (match) return match
    }
    return null
  }

  const customerConsentPayload = {
    accepts_marketing: consent.accepts_marketing,
    accepts_marketing_updated_at: consent.consent_updated_at,
    marketing_opt_in_level: consent.opt_in_level,
    email_marketing_consent: {
      state: consent.state,
      opt_in_level: consent.opt_in_level,
      consent_updated_at: consent.consent_updated_at,
    },
  }

  try {
    const existing = await findExisting()
    if (existing) {
      const tags = (existing.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
      if (!tags.includes("pbs-lead")) tags.push("pbs-lead")
      await fetch(
        `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers/${existing.id}.json`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            customer: {
              id: existing.id,
              tags: tags.join(", "),
              ...customerConsentPayload,
            },
          }),
        },
      )
      return String(existing.id)
    }

    const createRes = await fetch(
      `https://${shopName}.myshopify.com/admin/api/${API_VERSION}/customers.json`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer: {
            email,
            tags: "pbs-lead",
            ...customerConsentPayload,
          },
        }),
      },
    )
    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "")
      console.warn("Shopify customer create failed", createRes.status, errText)
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

          // Build (and assert) the marketing consent payload once.
          const optInMode = resolveOptInMode()
          const consent = buildMarketingConsent(optInMode)

          // 1. Best-effort: create / tag Shopify customer.
          let shopifyCustomerId: string | null = null
          const SHOPIFY_STORE = process.env.SHOPIFY_STORE
          const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
          if (SHOPIFY_STORE && SHOPIFY_ACCESS_TOKEN) {
            shopifyCustomerId = await upsertShopifyLead(
              normalizeShopifyStore(SHOPIFY_STORE),
              SHOPIFY_ACCESS_TOKEN,
              rawEmail,
              consent,
            )
          }

          // 2. Upsert into quote_leads. Only set shopify_customer_id when we
          // actually have one — never overwrite an existing id with null.
          // Persist consent state so we always know if a lead is subscribed
          // (single opt-in) or still pending confirmation (double opt-in).
          const row = {
            email: rawEmail,
            product_type: productType,
            step_reached: stepReached,
            last_config: lastConfig as never,
            marketing_opt_in_level: consent.opt_in_level,
            marketing_consent_state: consent.state,
            marketing_consent_updated_at: consent.consent_updated_at,
            updated_at: new Date().toISOString(),
            ...(shopifyCustomerId ? { shopify_customer_id: shopifyCustomerId } : {}),
          } as never
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
            {
              ok: true,
              savedShopify: !!shopifyCustomerId,
              optInMode,
              consentState: consent.state,
            },
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

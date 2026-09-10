import { createFileRoute } from "@tanstack/react-router"
import { supabaseAdmin } from "@/integrations/supabase/client.server"
import {
  SHOPIFY_API_VERSION,
  findCustomerByEmail,
  mergeTags,
  normalizeShopifyStore,
  setEmailMarketingConsent,
  shopifyHeaders,
  type ConsentState,
} from "@/lib/shopify-customers.server"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Opt-in mode: "double" enables Shopify's confirmation email flow (leads land
// as "pending" until they click the confirm link). Defaults to "single" so
// existing behavior is preserved unless MARKETING_OPT_IN_MODE=double is set.
type OptInMode = "single" | "double"
function resolveOptInMode(): OptInMode {
  const raw = process.env.MARKETING_OPT_IN_MODE
  const normalized = (raw ?? "").trim().toLowerCase()
  if (normalized === "single" || normalized === "double") return normalized
  if (normalized) {
    console.warn(
      `[pbs-capture-lead] Invalid MARKETING_OPT_IN_MODE ${JSON.stringify(raw)} — falling back to 'single'.`,
    )
  }
  return "single"
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

interface ShopifyLeadResult {
  customerId: string | null
  /** State Shopify actually reports after the write — never assumed. */
  state: ConsentState | null
}

async function upsertShopifyLead(
  shopName: string,
  accessToken: string,
  email: string,
  consent: MarketingConsent,
): Promise<ShopifyLeadResult> {
  const headers = shopifyHeaders(accessToken)
  try {
    const existing = await findCustomerByEmail(shopName, accessToken, email)
    if (existing) {
      const res = await setEmailMarketingConsent(shopName, accessToken, existing.id, {
        state: consent.state,
        optInLevel: consent.opt_in_level,
        consentUpdatedAt: consent.consent_updated_at,
        tags: mergeTags(existing.tags, "pbs-lead"),
      })
      if (!res.ok) {
        console.warn(
          `[pbs-capture-lead] consent update did not take for customer ${existing.id}:`,
          res.error ?? `state=${res.state}`,
        )
      }
      return { customerId: String(existing.id), state: res.state }
    }

    const createRes = await fetch(
      `https://${shopName}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/customers.json`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer: {
            email,
            tags: "pbs-lead",
            accepts_marketing: true,
            accepts_marketing_updated_at: consent.consent_updated_at,
            marketing_opt_in_level: consent.opt_in_level,
            email_marketing_consent: {
              state: consent.state,
              opt_in_level: consent.opt_in_level,
              consent_updated_at: consent.consent_updated_at,
            },
          },
        }),
      },
    )
    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "")
      console.warn("[pbs-capture-lead] Shopify customer create failed", createRes.status, errText)
      if (createRes.status === 422 && /already.*taken/i.test(errText)) {
        await new Promise((r) => setTimeout(r, 600))
        const retry = await findCustomerByEmail(shopName, accessToken, email)
        if (retry) {
          const res = await setEmailMarketingConsent(shopName, accessToken, retry.id, {
            state: consent.state,
            optInLevel: consent.opt_in_level,
            consentUpdatedAt: consent.consent_updated_at,
            tags: mergeTags(retry.tags, "pbs-lead"),
          })
          return { customerId: String(retry.id), state: res.state }
        }
      }
      return { customerId: null, state: null }
    }
    const cj = (await createRes.json()) as {
      customer?: { id: number; email_marketing_consent?: { state?: ConsentState } | null }
    }
    const created = cj.customer
    const state = created?.email_marketing_consent?.state ?? null
    if (created?.id && state !== consent.state) {
      // Create didn't honor the consent block — force it with an explicit update.
      const res = await setEmailMarketingConsent(shopName, accessToken, created.id, {
        state: consent.state,
        optInLevel: consent.opt_in_level,
        consentUpdatedAt: consent.consent_updated_at,
      })
      if (!res.ok) {
        console.warn(
          `[pbs-capture-lead] consent not applied on new customer ${created.id}:`,
          res.error ?? `state=${res.state}`,
        )
      }
      return { customerId: String(created.id), state: res.state }
    }
    return { customerId: created?.id ? String(created.id) : null, state }
  } catch (err) {
    console.warn("[pbs-capture-lead] upsertShopifyLead error", err)
    return { customerId: null, state: null }
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

          // 1. Best-effort: create / tag Shopify customer with marketing consent.
          let shopifyCustomerId: string | null = null
          let shopifyState: ConsentState | null = null
          const SHOPIFY_STORE = process.env.SHOPIFY_STORE
          const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
          if (SHOPIFY_STORE && SHOPIFY_ACCESS_TOKEN) {
            const result = await upsertShopifyLead(
              normalizeShopifyStore(SHOPIFY_STORE),
              SHOPIFY_ACCESS_TOKEN,
              rawEmail,
              consent,
            )
            shopifyCustomerId = result.customerId
            shopifyState = result.state
          }

          // 2. Upsert into quote_leads. Record the state Shopify actually
          // reports so a silent regression is visible in our own data.
          const row = {
            email: rawEmail,
            product_type: productType,
            step_reached: stepReached,
            last_config: lastConfig as never,
            marketing_opt_in_level: consent.opt_in_level,
            marketing_consent_state: shopifyState ?? consent.state,
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
              consentState: shopifyState ?? consent.state,
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

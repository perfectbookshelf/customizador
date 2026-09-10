import { createFileRoute } from "@tanstack/react-router"
import {
  findCustomerByEmail,
  getCustomer,
  mergeTags,
  normalizeShopifyStore,
  setEmailMarketingConsent,
} from "@/lib/shopify-customers.server"

/**
 * Admin-only, idempotent backfill: walks `quote_leads` and makes sure every
 * captured lead is subscribed in Shopify. Leads that unsubscribed themselves
 * after capture are left untouched.
 *
 * POST /api/public/pbs-backfill-consent
 *   headers: x-admin-secret: <BACKFILL_ADMIN_SECRET>
 *   body: { limit?: number, offset?: number, dryRun?: boolean }
 */
export const Route = createFileRoute("/api/public/pbs-backfill-consent")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.BACKFILL_ADMIN_SECRET
        const provided = request.headers.get("x-admin-secret") ?? ""
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 })
        }

        const SHOPIFY_STORE = process.env.SHOPIFY_STORE
        const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
        if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
          return Response.json({ error: "Shopify not configured" }, { status: 500 })
        }
        const shop = normalizeShopifyStore(SHOPIFY_STORE)

        const body = (await request.json().catch(() => ({}))) as {
          limit?: number
          offset?: number
          dryRun?: boolean
        }
        const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 250)
        const offset = Math.max(Number(body.offset) || 0, 0)
        const dryRun = body.dryRun === true

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server")
        const { data: leads, error } = await supabaseAdmin
          .from("quote_leads")
          .select("id, email, shopify_customer_id, marketing_consent_state, created_at")
          .order("created_at", { ascending: true })
          .range(offset, offset + limit - 1)
        if (error) return Response.json({ error: error.message }, { status: 500 })

        let updated = 0
        let alreadyOk = 0
        let skippedUnsubscribed = 0
        let notFound = 0
        let failed = 0

        for (const lead of leads ?? []) {
          try {
            let customer = lead.shopify_customer_id
              ? await getCustomer(shop, SHOPIFY_ACCESS_TOKEN, lead.shopify_customer_id)
              : null
            if (!customer) customer = await findCustomerByEmail(shop, SHOPIFY_ACCESS_TOKEN, lead.email)
            if (!customer) {
              notFound++
              continue
            }

            const state = customer.email_marketing_consent?.state ?? null
            if (state === "subscribed") {
              alreadyOk++
              continue
            }
            // Respect an explicit opt-out made after we captured the lead.
            if (state === "unsubscribed") {
              skippedUnsubscribed++
              continue
            }
            if (dryRun) {
              updated++
              continue
            }

            const now = new Date().toISOString()
            const res = await setEmailMarketingConsent(shop, SHOPIFY_ACCESS_TOKEN, customer.id, {
              state: "subscribed",
              optInLevel: "single_opt_in",
              consentUpdatedAt: now,
              tags: mergeTags(customer.tags, "pbs-lead"),
            })
            if (res.ok) {
              updated++
              await supabaseAdmin
                .from("quote_leads")
                .update({
                  shopify_customer_id: String(customer.id),
                  marketing_opt_in_level: "single_opt_in",
                  marketing_consent_state: "subscribed",
                  marketing_consent_updated_at: now,
                } as never)
                .eq("id", lead.id)
            } else {
              failed++
              console.warn("[pbs-backfill-consent] failed", lead.email, res.error ?? res.state)
            }
            // Stay well inside Shopify's REST rate limit.
            await new Promise((r) => setTimeout(r, 250))
          } catch (err) {
            failed++
            console.warn("[pbs-backfill-consent] error", lead.email, err)
          }
        }

        return Response.json({
          ok: true,
          dryRun,
          offset,
          processed: leads?.length ?? 0,
          nextOffset: offset + (leads?.length ?? 0),
          done: (leads?.length ?? 0) < limit,
          updated,
          alreadyOk,
          skippedUnsubscribed,
          notFound,
          failed,
        })
      },
    },
  },
})

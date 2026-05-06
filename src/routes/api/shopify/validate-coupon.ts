import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/shopify/validate-coupon")({
  // @ts-expect-error - server handlers are runtime-supported but not yet in route type
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          let SHOPIFY_STORE = process.env.SHOPIFY_STORE
          if (!SHOPIFY_STORE) throw new Error("SHOPIFY_STORE is not configured")
          if (!SHOPIFY_STORE.includes(".")) SHOPIFY_STORE = `${SHOPIFY_STORE}.myshopify.com`

          const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
          if (!SHOPIFY_ACCESS_TOKEN) throw new Error("SHOPIFY_ACCESS_TOKEN is not configured")

          const { code } = (await request.json()) as { code?: string }
          if (!code || typeof code !== "string" || code.trim().length === 0) {
            return Response.json({ valid: false, error: "No coupon code provided" }, { status: 400 })
          }

          const trimmedCode = code.trim().toUpperCase()

          const lookupUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/discount_codes/lookup.json?code=${encodeURIComponent(trimmedCode)}`
          const lookupRes = await fetch(lookupUrl, {
            headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN },
            redirect: "follow",
          })

          if (!lookupRes.ok) {
            if (lookupRes.status === 404) {
              return Response.json({ valid: false, error: "Coupon code not found" }, { status: 200 })
            }
            return Response.json({ valid: false, error: `Lookup failed (${lookupRes.status})` }, { status: 200 })
          }

          const lookupData = await lookupRes.json()
          const dc = lookupData.discount_code
          if (!dc?.price_rule_id) {
            return Response.json({ valid: false, error: "Invalid coupon" }, { status: 200 })
          }

          const prUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/price_rules/${dc.price_rule_id}.json`
          const prRes = await fetch(prUrl, { headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN } })
          if (!prRes.ok) {
            return Response.json({ valid: false, error: "Could not load price rule" }, { status: 200 })
          }

          const rule = (await prRes.json()).price_rule
          const rawValue = Math.abs(parseFloat(rule.value))
          const valueType = rule.value_type === "percentage" ? "percentage" : "fixed_amount"
          const description =
            rule.title ||
            (valueType === "percentage" ? `${rawValue}% off` : `$${rawValue.toFixed(2)} off`)

          return Response.json({
            valid: true,
            code: trimmedCode,
            valueType,
            value: rawValue.toString(),
            description,
          })
        } catch (error: unknown) {
          console.error("Coupon validation error:", error)
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          return Response.json({ valid: false, error: errorMessage }, { status: 500 })
        }
      },
    },
  },
})

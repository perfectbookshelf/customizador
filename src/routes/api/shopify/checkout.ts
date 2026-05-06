import { createFileRoute } from "@tanstack/react-router"

function toFraction(decimal: number): string {
  const whole = Math.floor(decimal)
  const frac = decimal - whole
  const eighths = Math.round(frac * 8)
  if (eighths === 0) return `${whole}"`
  if (eighths === 8) return `${whole + 1}"`
  const map: Record<number, string> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" }
  return `${whole} ${map[eighths]}"`
}

export const Route = createFileRoute("/api/shopify/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let SHOPIFY_STORE = process.env.SHOPIFY_STORE
          if (!SHOPIFY_STORE) throw new Error("SHOPIFY_STORE is not configured")
          if (!SHOPIFY_STORE.includes(".")) SHOPIFY_STORE = `${SHOPIFY_STORE}.myshopify.com`

          const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
          if (!SHOPIFY_ACCESS_TOKEN) throw new Error("SHOPIFY_ACCESS_TOKEN is not configured")

          const { price, config, discountCode } = (await request.json()) as {
            price: string
            config: any
            imageDataUrl?: string | null
            discountCode?: string | null
          }

          if (!price || !config) {
            return Response.json({ success: false, error: "Missing price or config" }, { status: 400 })
          }

          const dims = config.dimensions || {}
          const noteLines: string[] = []
          if (config.skus && Array.isArray(config.skus)) {
            noteLines.push("--- SKUs ---")
            for (const sku of config.skus) {
              noteLines.push(`${sku.name}: ${sku.totalQuantity || sku.quantity || 0}`)
            }
          }

          let totalDimensions = ""
          const bt = config.bookshelfType || ""
          if (bt === "usurround") {
            totalDimensions = `${toFraction(dims.w1 || 0)} x ${toFraction(dims.w || 0)} x ${toFraction(dims.w2 || 0)} x ${toFraction(dims.height || 0)}`
          } else if (bt === "corner") {
            totalDimensions = `${toFraction(dims.width || 0)} x ${toFraction(dims.width2 || 0)} x ${toFraction(dims.height || 0)}`
          } else if (bt === "cathedral") {
            totalDimensions = `${toFraction(dims.W || 0)} x ${toFraction(dims.H || 0)}–${toFraction(dims.H1 || 0)}`
          } else if (bt === "portal") {
            totalDimensions = `${toFraction(dims.wallWidth || 0)} x ${toFraction(dims.wallHeight || 0)}`
          } else {
            totalDimensions = `${toFraction(dims.width || 0)} x ${toFraction(dims.height || 0)}`
          }

          noteLines.unshift(
            `Type: ${config.bookshelfType || "N/A"}`,
            `Finish: ${config.finish || "N/A"}`,
            `Total Dimensions: ${totalDimensions}`,
          )

          const lineItemProperties: { name: string; value: string }[] = [
            { name: "Type", value: config.bookshelfType || "Custom" },
            { name: "Finish", value: config.finish || "N/A" },
            { name: "Total Dimensions", value: totalDimensions },
          ]

          if (config.shelves && Array.isArray(config.shelves)) {
            const shelfW = config.dimensions?.width || config.dimensions?.W || "?"
            const label = config.bookshelfType === "corner" ? "W1 Shelf" : "Shelf"
            config.shelves.forEach((s: any, i: number) => {
              lineItemProperties.push({ name: `${label} ${i + 1}`, value: `${shelfW}" x ${s.height}" x ${s.depth}"` })
            })
            if (config.shelves2 && Array.isArray(config.shelves2)) {
              const w2 = config.dimensions?.width2 || "?"
              config.shelves2.forEach((s: any, i: number) => {
                lineItemProperties.push({ name: `W2 Shelf ${i + 1}`, value: `${w2}" x ${s.height}" x ${s.depth}"` })
              })
            }
          } else if (config.shelves && typeof config.shelves === "object") {
            for (const [wall, shelves] of Object.entries(config.shelves)) {
              if (Array.isArray(shelves)) {
                const wallWidths: Record<string, any> = { left: config.dimensions?.w1, front: config.dimensions?.w, right: config.dimensions?.w2 }
                const ww = wallWidths[wall] || "?"
                ;(shelves as any[]).forEach((s: any, i: number) => {
                  lineItemProperties.push({ name: `${wall.charAt(0).toUpperCase() + wall.slice(1)} Shelf ${i + 1}`, value: `${ww}" x ${s.height}" x ${s.depth}"` })
                })
              }
            }
          }

          let appliedDiscount: Record<string, unknown> | undefined
          if (discountCode && typeof discountCode === "string") {
            try {
              const lookupUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/discount_codes/lookup.json?code=${encodeURIComponent(discountCode.trim())}`
              const lookupRes = await fetch(lookupUrl, {
                headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN },
                redirect: "follow",
              })
              if (lookupRes.ok) {
                const lookupData = await lookupRes.json()
                const dc = lookupData.discount_code
                if (dc?.price_rule_id) {
                  const prUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/price_rules/${dc.price_rule_id}.json`
                  const prRes = await fetch(prUrl, { headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN } })
                  if (prRes.ok) {
                    const rule = (await prRes.json()).price_rule
                    const rawValue = Math.abs(parseFloat(rule.value))
                    appliedDiscount = {
                      description: rule.title || discountCode,
                      value_type: rule.value_type === "percentage" ? "percentage" : "fixed_amount",
                      value: rawValue.toString(),
                      amount:
                        rule.value_type === "percentage"
                          ? ((parseFloat(price) * rawValue) / 100).toFixed(2)
                          : rawValue.toFixed(2),
                      title: rule.title || discountCode,
                    }
                    noteLines.push(`Discount: ${discountCode} (${rule.value_type === "percentage" ? rawValue + "%" : "$" + rawValue.toFixed(2)} off)`)
                  }
                }
              }
            } catch (e) {
              console.error("Discount lookup failed:", e)
            }
          }

          const draftOrderPayload: Record<string, unknown> = {
            draft_order: {
              line_items: [
                {
                  title: `Custom ${(config.bookshelfType || "Bookshelf").charAt(0).toUpperCase() + (config.bookshelfType || "bookshelf").slice(1)} - ${config.finish || "Standard"}`,
                  price,
                  quantity: 1,
                  properties: lineItemProperties,
                },
              ],
              note: noteLines.join("\n"),
              tags: `pbs-configurator, ${config.bookshelfType || "custom"}`,
              ...(appliedDiscount ? { applied_discount: appliedDiscount } : {}),
            },
          }

          const shopifyUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/draft_orders.json`
          const shopifyResponse = await fetch(shopifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            },
            body: JSON.stringify(draftOrderPayload),
          })

          const shopifyData = await shopifyResponse.json()

          if (!shopifyResponse.ok) {
            console.error("Shopify API error:", JSON.stringify(shopifyData))
            throw new Error(`Shopify API error [${shopifyResponse.status}]`)
          }

          const invoiceUrl = shopifyData.draft_order?.invoice_url
          if (!invoiceUrl) throw new Error("No invoice_url returned from Shopify")

          return Response.json({
            success: true,
            invoiceUrl,
            draftOrderId: shopifyData.draft_order?.id,
          })
        } catch (error: unknown) {
          console.error("Error creating draft order:", error)
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          return Response.json({ success: false, error: errorMessage }, { status: 500 })
        }
      },
    },
  },
})

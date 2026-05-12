import { createFileRoute } from "@tanstack/react-router"
import { uploadDataUrlToShopifyFiles } from "@/lib/shopify-files.server"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function normalizeShopifyStore(store: string) {
  return store
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com$/i, "")
}

export const Route = createFileRoute("/api/pbs-create-checkout")({
  // @ts-expect-error - server handlers are runtime-supported but not yet in route type
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 200, headers: corsHeaders }),
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json()
          const { price, config, imageDataUrl, schematicDataUrl } = body
          const amount = Number.parseFloat(price)

          if (Number.isNaN(amount) || amount <= 0) {
            return Response.json({ error: "Invalid price" }, { status: 400, headers: corsHeaders })
          }

          const SHOPIFY_STORE = process.env.SHOPIFY_STORE
          const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN

          if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
            return Response.json({ error: "Missing Shopify configuration" }, { status: 500, headers: corsHeaders })
          }

          const dimensions = config?.dimensions || {}
          const width = config?.width ?? dimensions.width ?? dimensions.W ?? dimensions.wallWidth
          const height = config?.height ?? dimensions.height ?? dimensions.H ?? dimensions.wallHeight
          const shelves = Array.isArray(config?.shelves) ? config.shelves : []
          const shelvesCount = config?.shelvesCount ?? shelves.length

          const properties: Array<{ name: string; value: string }> = [
            { name: "Width", value: width ? `${width}"` : "Not specified" },
            { name: "Total Height", value: height ? `${Number(height).toFixed(2)}"` : "Not specified" },
            { name: "Number of Shelves", value: shelvesCount ? String(shelvesCount) : "0" },
          ]
          if (shelves.length > 0) {
            for (let i = 0; i < shelves.length; i++) {
              const s = shelves[i]
              properties.push({ name: `Shelf ${i + 1}`, value: `${s.height}" H x ${s.depth}" D` })
            }
          } else {
            properties.push({ name: "Shelf Configuration", value: "No shelves configured" })
          }
          properties.push({ name: "Finish", value: config?.finish || "Not selected" })

          const shopName = normalizeShopifyStore(SHOPIFY_STORE)

          // Best-effort: upload preview + schematic so the customer sees them
          // in the invoice/checkout. Never block checkout if upload fails.
          const ts = Date.now()
          if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
            const url = await uploadDataUrlToShopifyFiles(
              shopName,
              SHOPIFY_ACCESS_TOKEN,
              imageDataUrl,
              `pbs-preview-${ts}.png`,
            )
            if (url) properties.push({ name: "Preview Image", value: url })
          }
          if (typeof schematicDataUrl === "string" && schematicDataUrl.startsWith("data:")) {
            const url = await uploadDataUrlToShopifyFiles(
              shopName,
              SHOPIFY_ACCESS_TOKEN,
              schematicDataUrl,
              `pbs-schematic-${ts}.png`,
            )
            if (url) properties.push({ name: "Schematic", value: url })
          }

          const draftOrderPayload = {
            draft_order: {
              line_items: [
                {
                  title: "Custom Bookshelf - Configuration",
                  quantity: 1,
                  price: amount.toFixed(2),
                  properties,
                },
              ],
              note: `PBS Configurator | ${config?.finish || "N/A"} | ${width || "?"}" W x ${height || "?"}" H | ${shelvesCount} shelves`,
              use_customer_default_address: true,
            },
          }

          const createResponse = await fetch(
            `https://${shopName}.myshopify.com/admin/api/2025-01/draft_orders.json`,
            {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(draftOrderPayload),
            },
          )

          const createText = await createResponse.text()
          let createJson: any
          try {
            createJson = JSON.parse(createText)
          } catch {
            return Response.json({ error: "Invalid Shopify response" }, { status: 500, headers: corsHeaders })
          }

          if (!createResponse.ok) {
            console.error("Shopify create error:", createJson)
            return Response.json({ error: "Error creating order", detail: createJson }, { status: 500, headers: corsHeaders })
          }

          const checkoutUrl = createJson.draft_order?.invoice_url
          if (checkoutUrl) {
            return Response.json({ checkoutUrl }, { headers: corsHeaders })
          }

          return Response.json({ error: "No invoice URL" }, { status: 500, headers: corsHeaders })
        } catch (err: any) {
          console.error("Handler error:", err)
          return Response.json({ error: "Internal error", detail: err?.message }, { status: 500, headers: corsHeaders })
        }
      },
    },
  },
})
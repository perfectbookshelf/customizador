import { createFileRoute } from "@tanstack/react-router"

function normalizeShopifyStore(store: string) {
  return store.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.myshopify\.com$/i, "")
}

export const Route = createFileRoute("/api/shopify/debug-last-order")({
  // @ts-expect-error - server handlers are runtime-supported but not yet in route type
  server: {
    handlers: {
      GET: async () => {
        const SHOPIFY_STORE = process.env.SHOPIFY_STORE
        const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
        if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
          return Response.json({ error: "missing secrets" }, { status: 500 })
        }
        const shop = normalizeShopifyStore(SHOPIFY_STORE)
        const res = await fetch(
          `https://${shop}.myshopify.com/admin/api/2025-01/draft_orders.json?limit=1&status=open`,
          { headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN } },
        )
        const json: any = await res.json().catch(() => ({}))
        const order = json?.draft_orders?.[0]
        return Response.json({
          status: res.status,
          id: order?.id,
          name: order?.name,
          created_at: order?.created_at,
          line_items: order?.line_items?.map((li: any) => ({
            title: li.title,
            properties: li.properties,
          })),
        })
      },
    },
  },
})

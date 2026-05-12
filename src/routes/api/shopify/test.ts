import { createFileRoute } from "@tanstack/react-router"

function normalizeShopifyStore(store: string) {
  return store
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com$/i, "")
}

export const Route = createFileRoute("/api/shopify/test")({
  // @ts-expect-error - server handlers are runtime-supported
  server: {
    handlers: {
      GET: async () => {
        const SHOPIFY_STORE = process.env.SHOPIFY_STORE
        const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN

        const result: any = {
          secrets: {
            SHOPIFY_STORE: SHOPIFY_STORE ? "Found" : "Missing",
            SHOPIFY_ACCESS_TOKEN: SHOPIFY_ACCESS_TOKEN ? "Found" : "Missing",
          },
          storeHandle: SHOPIFY_STORE ? normalizeShopifyStore(SHOPIFY_STORE) : null,
          tokenPrefix: SHOPIFY_ACCESS_TOKEN ? SHOPIFY_ACCESS_TOKEN.slice(0, 8) + "..." : null,
          tokenLength: SHOPIFY_ACCESS_TOKEN?.length ?? 0,
        }

        if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
          result.status = "error"
          result.message = "Missing one or more Shopify secrets"
          return Response.json(result, { status: 500 })
        }

        const handle = normalizeShopifyStore(SHOPIFY_STORE)
        const url = `https://${handle}.myshopify.com/admin/api/2025-01/shop.json`

        try {
          const res = await fetch(url, {
            headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN },
          })
          const text = await res.text()
          let body: any
          try { body = JSON.parse(text) } catch { body = text.slice(0, 300) }

          result.shopifyApi = {
            url,
            status: res.status,
            ok: res.ok,
            shop: res.ok ? { name: body?.shop?.name, domain: body?.shop?.domain, id: body?.shop?.id } : undefined,
            error: !res.ok ? body : undefined,
          }
          result.status = res.ok ? "ok" : "error"
          result.message = res.ok
            ? "Shopify credentials valid"
            : `Shopify API responded ${res.status}`
          return Response.json(result, { status: res.ok ? 200 : 500 })
        } catch (err: any) {
          result.status = "error"
          result.message = `Network error: ${err?.message}`
          return Response.json(result, { status: 500 })
        }
      },
    },
  },
})

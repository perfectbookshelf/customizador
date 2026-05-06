interface CheckoutPayload {
  price: string
  config: Record<string, any>
  imageDataUrl?: string | null
  discountCode?: string | null
}

export async function createShopifyCheckout(payload: CheckoutPayload): Promise<string> {
  const res = await fetch("/api/shopify/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data?.success || !data?.invoiceUrl) {
    throw new Error(data?.error || `Checkout failed (${res.status})`)
  }

  return data.invoiceUrl as string
}

interface CheckoutPayload {
  price: string
  config: Record<string, any>
  imageDataUrl?: string | null
  schematicDataUrl?: string | null
  discountCode?: string | null
}

export async function createShopifyCheckout(payload: CheckoutPayload): Promise<string> {
  const res = await fetch("/api/pbs-create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  const checkoutUrl = data?.checkoutUrl || data?.invoiceUrl

  if (!res.ok || !checkoutUrl) {
    throw new Error(data?.error || `Checkout failed (${res.status})`)
  }

  return checkoutUrl as string
}

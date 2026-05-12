/**
 * Best-effort lead capture: send the quote email to the server which will
 * (1) upsert into the `quote_leads` table and (2) create or tag a Shopify
 * customer with `pbs-lead`. Deduped per payload within a session so repeated
 * onBlur events don't spam the endpoint, while later steps can still update
 * step_reached / last_config for the same email.
 *
 * Never throws — must never block the wizard UX.
 */
const sent = new Set<string>()
let inflight: string | null = null

export interface CaptureLeadInput {
  email: string
  productType?: string
  stepReached?: string
  lastConfig?: unknown
}

export async function captureQuoteLead(input: CaptureLeadInput): Promise<void> {
  if (typeof window === "undefined") return
  const email = input.email?.trim().toLowerCase() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return
  const signature = JSON.stringify({
    email,
    productType: input.productType ?? null,
    stepReached: input.stepReached ?? null,
    lastConfig: input.lastConfig ?? null,
  })
  if (sent.has(signature) || inflight === signature) return
  inflight = signature
  try {
    const res = await fetch("/api/public/pbs-capture-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        productType: input.productType ?? null,
        stepReached: input.stepReached ?? null,
        lastConfig: input.lastConfig ?? null,
      }),
    })
    if (res.ok) sent.add(signature)
  } catch {
    /* swallow — capture is fire-and-forget */
  } finally {
    if (inflight === signature) inflight = null
  }
}

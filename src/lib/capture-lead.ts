/**
 * Best-effort lead capture: send the quote email to the server which will
 * (1) upsert into the `quote_leads` table and (2) create or tag a Shopify
 * customer with `pbs-lead`. Deduped per email value within a session so we
 * don't spam the endpoint on every onBlur.
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
  extraTags?: string[]
}

export async function captureQuoteLead(input: CaptureLeadInput): Promise<void> {
  if (typeof window === "undefined") return
  const email = input.email?.trim().toLowerCase() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return
  // Dedupe key includes intent so the same email can re-submit a consultation
  // even after the initial step-3 capture went through.
  const key = `${email}|${input.stepReached ?? ""}`
  if (sent.has(key) || inflight === key) return
  inflight = key
  try {
    const res = await fetch("/api/public/pbs-capture-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        productType: input.productType ?? null,
        stepReached: input.stepReached ?? null,
        lastConfig: input.lastConfig ?? null,
        extraTags: Array.isArray(input.extraTags) ? input.extraTags : null,
      }),
    })
    if (res.ok) sent.add(key)
  } catch {
    /* swallow — capture is fire-and-forget */
  } finally {
    if (inflight === key) inflight = null
  }
}

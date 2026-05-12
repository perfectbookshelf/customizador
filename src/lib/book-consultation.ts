import { captureQuoteLead } from "./capture-lead"

export const CONSULTATION_URL = "https://www.perfectbookshelf.com/pages/book-a-consultation"

export interface BookConsultationInput {
  email?: string | null
  productType?: string
  lastConfig?: unknown
}

/**
 * Fire-and-forget: if we have a valid email, push the lead to our backend
 * (Shopify customer + quote_leads row) tagged as a consultation request,
 * then open the consultation page in a new tab.
 */
export function bookConsultation(input: BookConsultationInput): void {
  if (input.email) {
    void captureQuoteLead({
      email: input.email,
      productType: input.productType,
      stepReached: "step-5-consultation",
      lastConfig: input.lastConfig,
      extraTags: ["pbs-consultation-request"],
    })
  }
  if (typeof window !== "undefined") {
    window.open(CONSULTATION_URL, "_blank", "noopener,noreferrer")
  }
}

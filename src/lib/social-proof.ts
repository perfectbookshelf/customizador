/**
 * Reviews and store facts shown inside the configurator.
 *
 * REVIEWS: only real customer reviews that the customer authorised for
 * marketing use. Never invent, edit the meaning of, or "improve" a review.
 * Every review block renders nothing while this list is empty, so the UI
 * is safe to ship before reviews are collected.
 *
 * REVIEW_SUMMARY: the aggregate rating as published by the review app
 * (Judge.me). Leave it null until there are enough reviews to show — the
 * star line is hidden while it is null or below MIN_REVIEWS_FOR_SUMMARY.
 *
 * STORE_FACTS: copied from the published Shopify policies (Shipping and
 * Refund & Cancellation, effective June 2026). Update them together with the
 * policies.
 */

export interface Review {
  /** As the customer wants to be shown, e.g. "Sarah K." */
  name: string
  /** City and state, e.g. "Brooklyn, NY". Optional. */
  location?: string
  rating: 1 | 2 | 3 | 4 | 5
  /** The review text, verbatim. Keep the short ones for the email sheet. */
  text: string
  /** Customer photo, with permission. Hosted on the Shopify CDN. */
  photoUrl?: string
  /** What they bought, e.g. "Bookshelf · Walnut". */
  product?: string
}

export const REVIEWS: Review[] = []

export interface ReviewSummary {
  average: number
  count: number
  /** Where the numbers come from, e.g. "Judge.me". */
  source: string
}

export const REVIEW_SUMMARY: ReviewSummary | null = null

export const MIN_REVIEWS_FOR_SUMMARY = 5

export const STORE_FACTS = {
  freeShippingThreshold: 600,
  freeShippingRegion: "contiguous US",
  productionBusinessDays: 25,
  transitBusinessDays: "2–7",
  madeIn: "Greenwich, CT",
  insuredThreshold: 600,
} as const

/** Short reviews (for tight spaces like the email sheet), best first. */
export function shortReviews(maxChars = 140): Review[] {
  return REVIEWS.filter((r) => r.rating >= 4 && r.text.length <= maxChars)
}

export function photoReviews(): Review[] {
  return REVIEWS.filter((r) => r.rating >= 4 && !!r.photoUrl)
}

export function visibleSummary(): ReviewSummary | null {
  if (!REVIEW_SUMMARY) return null
  if (REVIEW_SUMMARY.count < MIN_REVIEWS_FOR_SUMMARY) return null
  return REVIEW_SUMMARY
}

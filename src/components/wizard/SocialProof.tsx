import * as React from "react"
import { Star, Truck, Hammer, ShieldCheck, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  photoReviews,
  REVIEWS,
  shortReviews,
  STORE_FACTS,
  visibleSummary,
  type Review,
} from "@/lib/social-proof"

/**
 * Social proof and store facts for the configurator.
 * Every review block renders nothing until real reviews are added to
 * src/lib/social-proof.ts — nothing here is placeholder content.
 */

function Stars({ rating, className }: { rating: number; className?: string }) {
  const full = Math.round(rating)
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("h-3 w-3", i < full ? "fill-brand-walnut text-brand-walnut" : "text-border")}
        />
      ))}
    </span>
  )
}

function attribution(r: Review): string {
  return [r.name, r.location].filter(Boolean).join(" · ")
}

/** Step 1: star rating line plus one short customer quote. */
export function ReviewSummaryLine() {
  const summary = visibleSummary()
  const quote = shortReviews(120)[0]
  if (!summary && !quote) return null
  return (
    <div className="border-y border-border py-3 space-y-1.5" data-testid="review-summary">
      {summary && (
        <div className="flex items-center gap-2 text-[11px] tracking-[0.15em] uppercase text-foreground">
          <Stars rating={summary.average} />
          <span className="font-semibold">{summary.average.toFixed(1)}</span>
          <span className="text-muted-foreground">
            · {summary.count} reviews
          </span>
        </div>
      )}
      {quote && (
        <p className="text-xs text-muted-foreground leading-snug">
          “{quote.text}” <span className="whitespace-nowrap">— {attribution(quote)}</span>
        </p>
      )}
    </div>
  )
}

/** Email sheet: one short testimonial. */
export function EmailSheetReview() {
  const quote = shortReviews(140)[0]
  if (!quote) return null
  return (
    <figure className="mb-4 text-xs leading-snug" data-testid="email-sheet-review">
      <Stars rating={quote.rating} className="mb-1" />
      <blockquote className="text-foreground">“{quote.text}”</blockquote>
      <figcaption className="text-muted-foreground mt-1">— {attribution(quote)}</figcaption>
    </figure>
  )
}

/** Review step: up to 3 reviews, photo reviews first. */
export function ReviewCards() {
  const withPhoto = photoReviews()
  const rest = REVIEWS.filter((r) => r.rating >= 4 && !withPhoto.includes(r))
  const picks = [...withPhoto, ...rest].slice(0, 3)
  if (picks.length === 0) return null
  return (
    <div className="space-y-3" data-testid="review-cards">
      <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">From our customers</div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {picks.map((r, i) => (
          <figure key={i} className="snap-start shrink-0 w-56 border border-border bg-background">
            {r.photoUrl && (
              <img
                src={r.photoUrl}
                alt={r.product ? `${r.product} — customer photo` : "Customer photo"}
                loading="lazy"
                className="w-full aspect-[4/3] object-cover"
              />
            )}
            <div className="p-3 space-y-1.5">
              <Stars rating={r.rating} />
              <blockquote className="text-xs text-foreground leading-snug line-clamp-4">“{r.text}”</blockquote>
              <figcaption className="text-[11px] text-muted-foreground">
                {attribution(r)}
                {r.product ? ` · ${r.product}` : ""}
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}

/** Review step, next to Checkout: delivery timeline and shipping, from the published policies. */
export function TrustList({ total }: { total: number }) {
  const freeShipping = total >= STORE_FACTS.freeShippingThreshold
  const items: { icon: React.ElementType; title: string; detail: string }[] = [
    {
      icon: Hammer,
      title: `Made to order in ${STORE_FACTS.madeIn}`,
      detail: `Ships in about ${STORE_FACTS.productionBusinessDays} business days, then ${STORE_FACTS.transitBusinessDays} business days in transit.`,
    },
    freeShipping
      ? {
          icon: Truck,
          title: "Free ground shipping",
          detail: `Included on this order (${STORE_FACTS.freeShippingRegion}). Insured in transit.`,
        }
      : {
          icon: Truck,
          title: "Shipping calculated at checkout",
          detail: `Free ground shipping on orders over $${STORE_FACTS.freeShippingThreshold} (${STORE_FACTS.freeShippingRegion}).`,
        },
    {
      icon: ShieldCheck,
      title: "Changes free for 24 hours",
      detail: "Cancel or adjust at no charge within 24 hours, before production starts.",
    },
    {
      icon: Lock,
      title: "Secure checkout",
      detail: "Payment is processed by Shopify. We never store your card details.",
    },
  ]
  return (
    <ul className="space-y-3" data-testid="trust-list">
      {items.map(({ icon: Icon, title, detail }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon className="h-4 w-4 mt-0.5 shrink-0 text-brand-walnut" aria-hidden />
          <div>
            <div className="text-[11px] tracking-[0.15em] uppercase font-semibold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground leading-snug">{detail}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

# Make every captured email land as "Subscribed"

## What I found

The capture code that runs today does send the "subscribed" flag to your store — 86 leads recorded since it was added all carry that state. But there are **332 older leads** (from May through late August) captured *before* that code existed. Those people were created in your store with no marketing consent at all, which is exactly the "Unsubscribed" rows in your screenshot.

So two things are needed: confirm today's path really flips the switch in the store (not just in our records), and fix the 332 people already sitting there as unsubscribed.

## What I'll do

1. **Confirm the live behaviour** — run one real capture against the store for an existing test address and read the customer back to check the subscription state actually changed. If the current update call is being ignored by the store, switch that call to the store's dedicated "update email marketing consent" API, which cannot be silently ignored.

2. **Backfill the 332 old leads** — a one-off, admin-only routine that walks every lead in our records, finds the matching customer in the store, and sets email marketing consent to subscribed (single opt-in). It runs in batches, respects the store's rate limits, skips anyone who explicitly unsubscribed themselves after being captured, and records the result per lead so it can be re-run safely.

3. **Make failures visible** — today, if the store rejects the subscribe call, we still report success. I'll check the store's response, log a clear warning, and record the real outcome on the lead so a silent regression can't happen again.

## Notes

- People who deliberately unsubscribed will not be re-subscribed.
- I'll report how many were updated, skipped, and failed once the backfill runs.

## Technical detail

- `src/routes/api/public/pbs-capture-lead.ts`: verify the Shopify REST `PUT /customers/{id}` consent write is honoured on API 2025-01; if not, use GraphQL `customerEmailMarketingConsentUpdate`. Inspect and surface the response instead of ignoring it; persist real outcome into `quote_leads.marketing_consent_state`.
- New admin-only backfill (`src/routes/api/public/pbs-backfill-consent.ts`, guarded by a shared secret header): pages `quote_leads`, resolves `shopify_customer_id` (or searches by email), issues the consent mutation, throttles to Shopify's limits, updates `marketing_consent_state` / `marketing_consent_updated_at`.
- Skip rule: if the store reports `state = "unsubscribed"` with `consent_updated_at` later than our capture timestamp, leave it alone.

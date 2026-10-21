# Perfect Bookshelf — Customizer

A build-your-own bookshelf configurator. Customers pick a shape, size, shelves and
wood finish, see a live 3D model, leave an email, and pay through Shopify.

Live: https://create-yours.perfectbookshelf.com
Preview: https://id-preview--fbfb0bc5-6f44-4dcc-8e74-85731b03f64c.lovable.app

## Stack

- **React 19** + **TanStack Start v1** (file-based routes, SSR, server functions), built with **Vite 7**
- **Three.js** with `@react-three/fiber` and `@react-three/drei` for the 3D views
- **Tailwind CSS v4**, configured through `src/styles.css` with native `@theme` tokens
- **Lovable Cloud** (Supabase) for auth, the database and storage — backend ref `fvsplfyrnbuvtqnhcbfb`
- **Shopify** Admin API for draft orders, coupon validation and checkout
- Deployed as a **Cloudflare Worker** (`wrangler.jsonc`, `@cloudflare/vite-plugin`)

## Run it

```bash
bun install
bun run dev        # http://localhost:8080
bun run build      # production build
bun run lint       # eslint
bun run format     # prettier
bunx vitest run    # test suite (jsdom, see vitest.config.ts)
```

Some tests are `bun test` only (bun-runner based) and are excluded from vitest — see
`vitest.config.ts`.

## The wizard

`src/components/BookshelfConfigurator.tsx` drives a five-step flow. The shell,
navigation and the email gate live in `src/components/wizard/`.

1. **Shape** — bookshelf, horizontal, corner, U-Surround or cathedral, plus dimensions and shelf layout
2. **Finish** — wood and baguette combination
3. **Email** — required before the quote is shown; saved to `quote_leads` with marketing consent
4. **Quote** — price, coupon field, checkout
5. **Photo** — an AI-rendered photorealistic room shot, offered for bookshelf, cathedral and horizontal only

The 3D canvas is 32dvh on mobile with sticky/nested scrolling disabled there; on iOS
the root uses `100svh` to stop the scroll bounce.

## Pricing

- `src/lib/pricing.ts` holds the shape-specific area formulas:
  - generic width: `height × width / 144`
  - corner (outside): `height × (arm1 + arm2 − deepest shelf depth) / 144`
  - corner (inside): `height × (arm1 + arm2) / 144`
  - U-Surround: `height × (left + back + right − 2 × deepest shelf depth) / 144`
  - cathedral: `width × average height / 144`
- Per-square-foot rates are the `FINISH_OPTIONS` array in `src/components/BookshelfConfigurator.tsx`
  (Oak/Oak 90.62, Oak/Black 99.06, Oak/White 91.38, White/White 75.44, Walnut/Walnut 99.24,
  Maple/Maple 74.37, Maple/Black 88.01, Black/Black 78.99).
- Customers never see square footage or the per-square-foot rate.
- Coupons come from Shopify price rules: `src/routes/api/shopify/validate-coupon.ts` checks
  the code, the checkout route applies the discount, and the UI adds a discount line.

## Conversion features

- **Progress tracker** — `WizardProgress` in `src/components/wizard/WizardShell.tsx`. Done steps can be revisited.
- **Early price estimate** — from Step 2 on, a range priced at the cheapest and the dearest available
  finish (`computePriceRange` in `src/lib/pricing.ts`, rounded outwards to $50 so the exact price always
  falls inside). Exact price and coupon still unlock only after the email. Toggle with
  `SHOW_PRICE_RANGE` in `BookshelfConfigurator.tsx`; every event records `pr` so before/after can be compared.
- **Popular layouts** — `PRESETS` in `BookshelfConfigurator.tsx`, modelled on real configurator orders.
- **Reviews** — `src/lib/social-proof.ts`. Only real, authorised reviews. Blocks stay hidden while the
  list is empty; the star line needs `REVIEW_SUMMARY` with at least `MIN_REVIEWS_FOR_SUMMARY` reviews.
- **Store facts** (lead time, shipping, 24h changes) — `STORE_FACTS` in the same file, copied from the
  Shopify Shipping and Refund policies. Keep them in sync.

## Funnel tracking

`track()` in `src/lib/track.ts` sends each event to:

1. `funnel_events` (Supabase) through `/api/public/pbs-funnel-event` — anonymous per-tab session id,
   UTM/referrer, device; never an email. Views `funnel_daily` and `funnel_sessions` summarise it.
2. GTM `dataLayer` — the store's container (`GTM-N4NTN29G`, override with `VITE_GTM_ID`, `off` to disable)
   loads in `__root.tsx` only when the configurator is the top-level page.
3. Meta Pixel standard events if a pixel is present (`Lead`, `InitiateCheckout`, `Contact`).
4. The host page via `pbs-ga4-event` postMessage when embedded in an iframe.

Events: `wizard_view`, `step_view` (0–4), `preset_selected`, `email_sheet_open`, `generate_lead`,
`finish_selected`, `coupon_applied`, `checkout_click`, `add_to_cart`, `begin_checkout`, `checkout_error`,
`book_consultation_click`.

## Two-tone finishes

`src/lib/finish.ts` is the single source of truth for which parts take the wood colour and
which take the baguette colour. **White has no entry in `src/lib/wood-textures.ts`** on purpose:
"White Oak / White" means oak structure with white baguettes, never white sides.
`src/components/__tests__/three-d-views.finish.test.tsx` enforces this for the 3D views.

## Backend routes

| Route | Purpose |
| --- | --- |
| `src/routes/api/pbs-create-checkout.ts` | Builds the Shopify draft order (`requires_shipping: true`), attaches the buyer email with a safe retry on odd domains, passes the quote email as a line-item property |
| `src/routes/api/shopify/checkout.ts` | Returns the payment page URL |
| `src/routes/api/shopify/validate-coupon.ts` | Checks a coupon against Shopify price rules |
| `src/routes/api/public/pbs-capture-lead.ts` | Saves the lead, forces marketing opt-in, records the consent state Shopify actually returns |
| `src/routes/api/public/pbs-funnel-event.ts` | Anonymous funnel events into `funnel_events`; schema-validated, rate-limited, rejects emails |
| `src/routes/api/public/pbs-backfill-consent.ts` | One-off admin tool to re-subscribe contacts, guarded by `BACKFILL_ADMIN_SECRET` |

Routes under `/api/public/` bypass site auth once published, so the handler itself must
verify the caller — that is why the backfill route checks its secret.

## Where things live

| Area | File |
| --- | --- |
| Wizard state, steps, prices | `src/components/BookshelfConfigurator.tsx` |
| Wizard shell, Back/Next, email gate | `src/components/wizard/WizardShell.tsx`, `QuoteEmailSheet.tsx` |
| 3D views | `src/components/Bookshelf3DView.tsx`, `Cathedral3DView.tsx`, `USurround3DView.tsx` |
| 2D schematics | `src/components/CathedralSchematic.tsx`, `USurroundSchematic.tsx` |
| Wood textures | `src/lib/wood-textures.ts` (files under `public/textures`) |
| AI room photo | `src/lib/render-photo.functions.ts` (Lovable AI Gateway) |
| Shopify customer / consent helpers | `src/lib/shopify-customers.server.ts` |
| Database schema | `supabase/migrations/` |
| SEO | `src/routes/index.tsx` (metadata, JSON-LD), `src/routes/sitemap[.]xml.ts`, `public/robots.txt`, `public/llms.txt` |
| Favicon, fonts | `src/routes/__root.tsx` |

## Secrets and store data

Nothing sensitive is in this repository:

- Shopify tokens, the backfill secret and other credentials live in **Lovable Cloud → Secrets**,
  injected into the server runtime. They are never committed.
- Customer emails, leads and saved quotes live in the **database**, not in the code.
  Exporting the codebase does not export them: data is exported separately from
  Cloud → Advanced settings → Export data.
- `.env` holds only the backend URL, publishable key and project id — values that are already
  visible in the browser bundle. Do not put private keys there.

## Notes

- Portal was removed as a customer-facing option. `Portal3DView.tsx`, `PortalSchematic.tsx`
  and `portal-geometry.ts` are still in the tree and still tested; saved state that names
  Portal is coerced back to a plain bookshelf.
- `src/routeTree.gen.ts` is generated — never edit it by hand.
- `src/integrations/supabase/*` is generated — do not edit.
- Migrations are applied from the Lovable chat; pushing them to Git does not apply them.

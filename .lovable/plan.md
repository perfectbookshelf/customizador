# Make sure every order captures a shipping address

## What I checked

The customizer sends each configuration to Shopify as a draft order with one custom line item, then sends the buyer to the Shopify invoice page to pay.

Two things in the current code mean a shipping address is **not** guaranteed:

1. The line item is a custom item (not a real Shopify product) and no shipping flag is set on it. For custom line items Shopify treats the item as not needing shipping unless we say otherwise, so the checkout page can skip the address step entirely.
2. The order is created with "use the customer's default address", but no customer is attached to the order (the email is deliberately kept only as a note on the line item). With no customer there is no default address to pull in.

So today an order can be completed with no shipping address on it.

## What I'll change

- Mark the custom bookshelf line item as requiring shipping, so Shopify always asks the buyer for a delivery address before payment.
- Attach the buyer's email to the draft order when it is a valid address, so the order is linked to a customer record and any saved address is pre-filled. Keep the existing safety net: if Shopify rejects the email, retry without it instead of failing the checkout.
- Keep the email on the line item as well, so nothing is lost either way.

## How I'll confirm it

- Create a real test draft order through the live endpoint and check the returned order shows the item as shippable.
- Open the resulting checkout link and confirm the address step appears.
- Delete the test order afterwards.

## Technical notes

File: `src/routes/api/pbs-create-checkout.ts`
- Add `requires_shipping: true` (and keep `taxable` behaviour unchanged) on the custom line item.
- Send `email: cleanEmail` on the draft order; on a Shopify 4xx mentioning the email/domain, retry the create once without the `email` field.
- Leave `use_customer_default_address: true` in place — it becomes meaningful once a customer is linked.

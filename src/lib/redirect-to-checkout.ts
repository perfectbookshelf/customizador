/**
 * Redirect the user to an external URL (Shopify checkout, consultation, etc.).
 *
 * Preference order:
 *  1. Top-level navigation in the same tab (works when not iframed, or when
 *     the iframe is same-origin / allow-top-navigation).
 *  2. postMessage to the parent so an integrator can handle the redirect.
 *  3. Fallback: open in a new tab (only if same-tab navigation isn't possible).
 *
 * Returns true if some redirect path was attempted, false otherwise.
 */
export function redirectToCheckout(checkoutUrl: string): boolean {
  if (typeof window === "undefined") return false

  const inIframe = window.self !== window.top
  if (!inIframe) {
    window.location.href = checkoutUrl
    return true
  }

  // Notify the embedding page (no-op if nobody's listening).
  try {
    window.parent.postMessage({ type: "pbs-checkout-redirect", checkoutUrl }, "*")
  } catch {
    /* ignore */
  }

  // Try to navigate the top window in the same tab.
  try {
    if (window.top) {
      window.top.location.href = checkoutUrl
      return true
    }
  } catch {
    /* cross-origin — fall through to new-tab fallback */
  }

  // Last resort: new tab (popup may be blocked).
  const w = window.open(checkoutUrl, "_blank", "noopener,noreferrer")
  return !!w
}

/**
 * Redirect the user to a Shopify checkout URL.
 *
 * - Top-level window: navigate normally.
 * - Inside an iframe (preview / embed): open in a new tab so we don't navigate
 *   the embedding page (Shopify blocks iframing via X-Frame-Options anyway).
 *   We also send a postMessage so an integrator that wants to handle the
 *   redirect itself can do so.
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

  // Open Shopify in a brand new tab — never navigate the iframe itself,
  // because Shopify refuses to render inside one.
  const w = window.open(checkoutUrl, "_blank", "noopener,noreferrer")
  if (w) return true

  // Popup was blocked. Last resort: ask the top window to navigate.
  // If cross-origin this will throw; the integrator's postMessage listener
  // is then the only remaining path.
  try {
    if (window.top) {
      window.top.location.href = checkoutUrl
      return true
    }
  } catch {
    /* cross-origin — give up silently, postMessage above is the fallback */
  }
  return false
}

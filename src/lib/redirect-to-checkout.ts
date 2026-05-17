/**
 * Navigate the current tab to an external URL (Shopify checkout, consultation, etc.).
 *
 * Strict same-tab policy:
 *  - Never calls window.open (no popup, no new tab, no _blank).
 *  - Never sets target="_blank".
 *  - Prefers top-level navigation so the user leaves any embedding iframe.
 *  - Falls back to navigating the current frame if the top frame is cross-origin.
 *
 * Returns true if a navigation was issued, false otherwise.
 */
export function redirectToCheckout(checkoutUrl: string): boolean {
  if (typeof window === "undefined") return false

  // Basic URL validation — refuse empty / non-http(s) values.
  if (typeof checkoutUrl !== "string" || checkoutUrl.trim() === "") return false
  try {
    const parsed = new URL(checkoutUrl, window.location.href)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
  } catch {
    return false
  }

  if (import.meta.env.DEV) {
    console.debug("[checkout] same-tab redirect →", checkoutUrl)
  }

  // Notify any embedding page (no-op if nobody's listening). Embedders that
  // want to handle navigation themselves can listen for this message.
  try {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: "pbs-checkout-redirect", checkoutUrl }, "*")
    }
  } catch {
    /* ignore */
  }

  // Prefer top-level same-tab navigation when allowed (escapes the iframe).
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = checkoutUrl
      return true
    }
  } catch {
    /* cross-origin top — fall through to current-frame navigation */
  }

  // Same-tab navigation in the current frame. No window.open, no popup.
  window.location.assign(checkoutUrl)
  return true
}

/**
 * Shared persistence for the quote email across configurators and reloads.
 * Stored under a single key so the customer only types it once across all
 * product types (Bookshelf, Cathedral, Portal, U-Surround).
 */
const KEY = "pbs_quote_email"

export function loadQuoteEmail(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(KEY) ?? ""
  } catch {
    return ""
  }
}

export function saveQuoteEmail(email: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, email)
  } catch {
    /* ignore quota / privacy mode */
  }
}

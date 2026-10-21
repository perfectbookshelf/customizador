/**
 * Funnel tracking for the configurator.
 *
 * One call, four destinations — all best-effort, none may ever throw or
 * block the wizard:
 *   1. Our own `funnel_events` table, via /api/public/pbs-funnel-event
 *      (anonymous session id, no email or other personal data).
 *   2. GTM / GA4 via `dataLayer` (loaded on the top-level page, see __root.tsx).
 *   3. Meta Pixel standard events, when a pixel is present (e.g. through GTM).
 *   4. The embedding page, when the configurator runs inside an iframe
 *      (`pbs-ga4-event` postMessage, the pattern the site already used).
 */

export const FUNNEL_EVENTS = [
  "wizard_view",
  "step_view",
  "preset_selected",
  "email_sheet_open",
  "generate_lead",
  "finish_selected",
  "coupon_applied",
  "checkout_click",
  "add_to_cart",
  "begin_checkout",
  "checkout_error",
  "book_consultation_click",
] as const

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number]

export type TrackParams = Record<string, string | number | boolean | null | undefined>

export interface Attribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  /** Which ad click id was present on landing ("gclid", "fbclid", …) — never the id itself. */
  click_id_type?: string
  referrer_host?: string
}

const SESSION_KEY = "pbs_funnel_sid"
const ATTRIBUTION_KEY = "pbs_funnel_attr"
const ENDPOINT = "/api/public/pbs-funnel-event"

/** Meta Pixel standard events for the steps ad platforms should optimise on. */
const META_EVENT: Partial<Record<FunnelEventName, string>> = {
  generate_lead: "Lead",
  begin_checkout: "InitiateCheckout",
  book_consultation_click: "Contact",
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function storageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function storageSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* private mode — the id just won't survive a reload */
  }
}

let memorySessionId: string | null = null

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr"
  const stored = storageGet(SESSION_KEY)
  if (stored) return stored
  const id = memorySessionId ?? randomId()
  memorySessionId = id
  storageSet(SESSION_KEY, id)
  return id
}

function clip(value: string | null | undefined, max = 100): string | undefined {
  if (!value) return undefined
  const v = value.trim()
  return v ? v.slice(0, max) : undefined
}

/** Read UTM / click-id / referrer once per session, on the landing page view. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {}
  const cached = storageGet(ATTRIBUTION_KEY)
  if (cached) {
    try {
      return JSON.parse(cached) as Attribution
    } catch {
      /* re-derive */
    }
  }
  const attr: Attribution = {}
  try {
    const params = new URLSearchParams(window.location.search)
    attr.utm_source = clip(params.get("utm_source"))
    attr.utm_medium = clip(params.get("utm_medium"))
    attr.utm_campaign = clip(params.get("utm_campaign"))
    attr.utm_content = clip(params.get("utm_content"))
    attr.utm_term = clip(params.get("utm_term"))
    const clickId = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"].find((k) => params.get(k))
    attr.click_id_type = clickId
    if (document.referrer) {
      const host = new URL(document.referrer).hostname
      if (host && host !== window.location.hostname) attr.referrer_host = clip(host, 120)
    }
  } catch {
    /* ignore malformed URLs */
  }
  storageSet(ATTRIBUTION_KEY, JSON.stringify(attr))
  return attr
}

function inIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function deviceType(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth || 1024
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop"
}

/** Drop personal data defensively: no emails, no long free text. */
function sanitize(params: TrackParams): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    if (/email/i.test(k)) continue
    if (typeof v === "string") {
      if (v.includes("@")) continue
      out[k] = v.slice(0, 120)
    } else if (typeof v === "number") {
      if (Number.isFinite(v)) out[k] = Math.round(v * 100) / 100
    } else {
      out[k] = v
    }
  }
  return out
}

function sendToServer(event: FunnelEventName, props: Record<string, string | number | boolean | null>): void {
  const { step, step_name, product_type, ...rest } = props
  const body = JSON.stringify({
    sessionId: getSessionId(),
    event,
    step: typeof step === "number" ? step : null,
    stepName: typeof step_name === "string" ? step_name : null,
    productType: typeof product_type === "string" ? product_type : null,
    props: rest,
    attribution: getAttribution(),
    device: deviceType(),
    inIframe: inIframe(),
  })
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
      if (ok) return
    }
  } catch {
    /* fall back to fetch */
  }
  try {
    if (typeof fetch !== "function") return
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* never surface tracking errors */
  }
}

type AnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>
  gtag?: (...args: unknown[]) => void
  fbq?: (...args: unknown[]) => void
}

export function track(event: FunnelEventName, params: TrackParams = {}): void {
  if (typeof window === "undefined") return
  if (import.meta.env.MODE === "test") return
  const props = sanitize(params)

  sendToServer(event, props)

  const w = window as AnalyticsWindow
  try {
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...props })
  } catch {
    /* ignore */
  }
  try {
    const meta = META_EVENT[event]
    if (meta && typeof w.fbq === "function") {
      const value = typeof props.value === "number" ? props.value : undefined
      w.fbq("track", meta, value !== undefined ? { value, currency: "USD" } : {})
    }
  } catch {
    /* ignore */
  }
  if (inIframe()) {
    try {
      window.parent.postMessage({ type: "pbs-ga4-event", eventName: event, params: props }, "*")
    } catch {
      /* ignore */
    }
  }
}

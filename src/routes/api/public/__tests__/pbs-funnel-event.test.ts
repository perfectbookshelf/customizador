import { describe, expect, it, vi } from "vitest"

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }))

const { FunnelEventSchema } = await import("../pbs-funnel-event")

const base = {
  sessionId: "0f8c2a9e-4b1d-4c55-9a3e-1d2f3a4b5c6d",
  event: "step_view",
  step: 1,
  stepName: "dimensions",
  productType: "bookshelf",
  props: { pr: true, lead_known: false },
  attribution: { utm_source: "google", click_id_type: "gclid" },
  device: "mobile",
  inIframe: false,
}

describe("funnel event schema", () => {
  it("accepts a normal step event", () => {
    expect(FunnelEventSchema.safeParse(base).success).toBe(true)
  })

  it("rejects unknown events", () => {
    expect(FunnelEventSchema.safeParse({ ...base, event: "drop_table" }).success).toBe(false)
  })

  it("rejects anything that looks like an email", () => {
    expect(FunnelEventSchema.safeParse({ ...base, stepName: "a@b.com" }).success).toBe(false)
    expect(
      FunnelEventSchema.safeParse({ ...base, attribution: { utm_source: "x@y.co" } }).success,
    ).toBe(false)
  })

  it("rejects malformed session ids and oversized props", () => {
    expect(FunnelEventSchema.safeParse({ ...base, sessionId: "<script>" }).success).toBe(false)
    const props = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, i]))
    expect(FunnelEventSchema.safeParse({ ...base, props }).success).toBe(false)
  })
})

import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/integrations/supabase/client.server"
import { FUNNEL_EVENTS } from "@/lib/track"

/**
 * Public, anonymous funnel-event sink for the configurator.
 *
 * Routes under /api/public/ bypass site auth once published, so this handler
 * defends itself: strict schema, small payloads, a per-session/IP rate limit,
 * and it never stores emails or free text. Writes go to `funnel_events`
 * (RLS on, no policies — only the service role can read or write).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const shortText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((v) => !v.includes("@"), "no emails")
    .optional()
    .nullable()

const propValue = z.union([z.string().max(120), z.number().finite(), z.boolean(), z.null()])

export const FunnelEventSchema = z.object({
  sessionId: z.string().min(8).max(64).regex(/^[A-Za-z0-9-]+$/),
  event: z.enum(FUNNEL_EVENTS),
  step: z.number().int().min(0).max(20).nullable().optional(),
  stepName: shortText(32),
  productType: shortText(32),
  props: z
    .record(z.string().max(40), propValue)
    .optional()
    .nullable()
    .refine((p) => !p || Object.keys(p).length <= 20, "too many props"),
  attribution: z
    .object({
      utm_source: shortText(100),
      utm_medium: shortText(100),
      utm_campaign: shortText(100),
      utm_content: shortText(100),
      utm_term: shortText(100),
      click_id_type: shortText(16),
      referrer_host: shortText(120),
    })
    .partial()
    .optional()
    .nullable(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional().nullable(),
  inIframe: z.boolean().optional().nullable(),
})

const MAX_BODY_BYTES = 4096
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 150

// Per-isolate limiter. Workers can run several isolates, so this is a cheap
// first line of defence rather than a hard global cap.
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string, now = Date.now()): boolean {
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
  }
  const entry = hits.get(key)
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

export const Route = createFileRoute("/api/public/pbs-funnel-event")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 200, headers: corsHeaders }),
      POST: async ({ request }: { request: Request }) => {
        try {
          const raw = await request.text()
          if (raw.length > MAX_BODY_BYTES) {
            return new Response(null, { status: 413, headers: corsHeaders })
          }
          let json: unknown
          try {
            json = JSON.parse(raw)
          } catch {
            return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders })
          }
          const parsed = FunnelEventSchema.safeParse(json)
          if (!parsed.success) {
            return Response.json({ error: "Invalid event" }, { status: 400, headers: corsHeaders })
          }
          const e = parsed.data

          const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "?"
          if (rateLimited(`${e.sessionId}|${ip}`) || rateLimited(`ip|${ip}`)) {
            return new Response(null, { status: 429, headers: corsHeaders })
          }

          const a = e.attribution ?? {}
          const row = {
            session_id: e.sessionId,
            event: e.event,
            step: e.step ?? null,
            step_name: e.stepName ?? null,
            product_type: e.productType ?? null,
            props: e.props ?? null,
            utm_source: a.utm_source ?? null,
            utm_medium: a.utm_medium ?? null,
            utm_campaign: a.utm_campaign ?? null,
            utm_content: a.utm_content ?? null,
            utm_term: a.utm_term ?? null,
            click_id_type: a.click_id_type ?? null,
            referrer_host: a.referrer_host ?? null,
            device: e.device ?? null,
            in_iframe: e.inIframe ?? null,
          }

          // `funnel_events` is newer than the generated types file, so use an
          // untyped handle for this one insert.
          const db = supabaseAdmin as unknown as SupabaseClient
          const { error } = await db.from("funnel_events").insert(row)
          if (error) {
            console.warn("[pbs-funnel-event] insert error", error.message)
            return new Response(null, { status: 500, headers: corsHeaders })
          }
          return new Response(null, { status: 204, headers: corsHeaders })
        } catch (err) {
          console.error("[pbs-funnel-event] error", err)
          return new Response(null, { status: 500, headers: corsHeaders })
        }
      },
    },
  },
})

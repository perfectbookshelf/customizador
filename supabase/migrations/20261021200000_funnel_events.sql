-- Anonymous configurator funnel events (one row per step view / action).
-- No email or other personal data: the session id is a random per-tab id.
create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  event text not null,
  step smallint,
  step_name text,
  product_type text,
  props jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  click_id_type text,
  referrer_host text,
  device text,
  in_iframe boolean
);

create index if not exists funnel_events_created_at_idx on public.funnel_events (created_at);
create index if not exists funnel_events_session_idx on public.funnel_events (session_id);
create index if not exists funnel_events_event_created_idx on public.funnel_events (event, created_at);

alter table public.funnel_events enable row level security;
-- No policies = no client access. Only the server (service role) can read/write.

-- Daily funnel: distinct sessions that reached each event / step.
-- security_invoker keeps the table's RLS in force for anyone querying the view.
create or replace view public.funnel_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at at time zone 'America/New_York')::date as day,
  event,
  step,
  step_name,
  count(distinct session_id) as sessions
from public.funnel_events
group by 1, 2, 3, 4;

-- Whole-period funnel by traffic source, one row per session, for quick
-- "where do people drop off, by campaign" questions.
create or replace view public.funnel_sessions
with (security_invoker = true) as
select
  session_id,
  min(created_at) as first_seen,
  max(utm_source) as utm_source,
  max(utm_campaign) as utm_campaign,
  max(click_id_type) as click_id_type,
  max(device) as device,
  max(product_type) as product_type,
  coalesce(max(step) filter (where event = 'step_view'), 0) + 1 as furthest_step,
  bool_or(event = 'email_sheet_open') as opened_email,
  bool_or(event = 'generate_lead') as left_email,
  bool_or(event = 'coupon_applied') as applied_coupon,
  bool_or(event = 'checkout_click') as clicked_checkout,
  bool_or(event = 'begin_checkout') as reached_checkout,
  bool_or(event = 'book_consultation_click') as asked_consultation,
  bool_or(event = 'preset_selected') as used_preset
from public.funnel_events
group by session_id;

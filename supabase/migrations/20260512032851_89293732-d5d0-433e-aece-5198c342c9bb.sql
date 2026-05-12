create table public.quote_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  product_type text,
  step_reached text,
  last_config jsonb,
  shopify_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quote_leads_email_idx on public.quote_leads (lower(email));

alter table public.quote_leads enable row level security;

-- No policies = no client access. Only server (service role) can read/write.

create or replace function public.tg_quote_leads_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger quote_leads_touch_updated_at
before update on public.quote_leads
for each row execute function public.tg_quote_leads_touch_updated_at();
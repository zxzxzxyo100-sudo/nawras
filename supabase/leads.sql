-- Lead Management module (leads table + RLS)
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_source') then
    create type public.lead_source as enum ('social_media', 'field_visit', 'referral');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_contact_status') then
    create type public.lead_contact_status as enum ('pending', 'answered', 'no_answer');
  end if;
end $$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  phone_number text not null,
  source public.lead_source not null default 'social_media',
  contact_status public.lead_contact_status not null default 'pending',
  requires_field_visit boolean not null default false,
  field_visit_done boolean not null default false,
  account_opened boolean not null default false,
  assigned_to uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (contact_status, account_opened);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_set_updated_at on public.leads;
create trigger trg_leads_set_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();

alter table public.leads enable row level security;
alter table public.leads force row level security;

-- Optional helper: resolve user role from JWT app metadata.
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    ''
  );
$$;

drop policy if exists "leads_select_authorized" on public.leads;
create policy "leads_select_authorized"
on public.leads
for select
using (
  public.current_app_role() in ('admin', 'data_collector')
  or assigned_to = auth.uid()
);

drop policy if exists "leads_insert_authorized" on public.leads;
create policy "leads_insert_authorized"
on public.leads
for insert
with check (
  public.current_app_role() in ('admin', 'data_collector')
  and (assigned_to = auth.uid() or public.current_app_role() = 'admin')
);

drop policy if exists "leads_update_authorized" on public.leads;
create policy "leads_update_authorized"
on public.leads
for update
using (
  public.current_app_role() in ('admin', 'data_collector')
  and (assigned_to = auth.uid() or public.current_app_role() = 'admin')
)
with check (
  public.current_app_role() in ('admin', 'data_collector')
  and (assigned_to = auth.uid() or public.current_app_role() = 'admin')
);

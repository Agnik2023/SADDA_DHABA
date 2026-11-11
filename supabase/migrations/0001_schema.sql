-- SADDA DHABA — core schema
-- Apply with the Supabase CLI or the SQL editor.
-- All money is stored as integer paise.

-- Supabase installs pgcrypto in the extensions schema. Both schemas are on the
-- function search_path so digest()/gen_random_bytes() resolve on Supabase and
-- on a plain PostgreSQL install where pgcrypto lands in public.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null check (role in ('dev', 'counter', 'kitchen')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  restaurant_name text not null default 'SADDA DHABA'
    check (char_length(restaurant_name) between 1 and 120),
  tax_rate_bps integer not null default 500
    check (tax_rate_bps between 0 and 5000),
  unpaid_timeout_minutes integer not null default 30
    check (unpaid_timeout_minutes between 5 and 240),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  price_paise integer not null check (price_paise > 0),
  is_veg boolean not null default true,
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  order_code text not null unique
    check (order_code ~ '^SD-[A-Z0-9]{5}$'),
  idempotency_key uuid not null unique,
  customer_name text not null
    check (char_length(customer_name) between 1 and 80),
  customer_phone text
    check (customer_phone is null or customer_phone ~ '^[6-9][0-9]{9}$'),
  order_type text not null check (order_type in ('DINE_IN', 'TAKEAWAY')),
  table_number text
    check (table_number is null or char_length(table_number) <= 20),
  status text not null default 'AWAITING_PAYMENT'
    check (status in (
      'AWAITING_PAYMENT',
      'QUEUED',
      'PREPARING',
      'READY',
      'SERVED',
      'COMPLETED',
      'CANCELLED'
    )),
  payment_status text not null default 'UNPAID'
    check (payment_status in ('UNPAID', 'PAID', 'REFUNDED')),
  payment_method text
    check (payment_method is null or payment_method in (
      'CASH',
      'UPI_COUNTER',
      'CARD_COUNTER'
    )),
  payment_reference text
    check (payment_reference is null or char_length(payment_reference) <= 120),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  tax_paise integer not null check (tax_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  paid_at timestamptz,
  paid_by uuid references public.staff(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.staff(id),
  cancel_reason text
    check (cancel_reason is null or char_length(cancel_reason) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (payment_status = 'UNPAID' or payment_method is not null),
  check (
    (status = 'AWAITING_PAYMENT' and payment_status = 'UNPAID')
    or (status in ('QUEUED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED')
        and payment_status = 'PAID')
    or (status = 'CANCELLED' and payment_status in ('UNPAID', 'REFUNDED'))
  ),
  check (status <> 'CANCELLED' or cancel_reason is not null)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name_snapshot text not null check (char_length(name_snapshot) between 1 and 120),
  unit_price_paise integer not null check (unit_price_paise > 0),
  qty integer not null check (qty between 1 and 20),
  is_veg boolean,
  line_no integer not null default 0 check (line_no >= 0)
);

create table if not exists public.order_tokens (
  order_id uuid primary key references public.orders(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  actor_id uuid references public.staff(id),
  actor_role text
    check (actor_role is null or actor_role in ('dev', 'counter', 'kitchen', 'system')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

create index if not exists orders_payment_status_idx
  on public.orders (payment_status, status);

create index if not exists orders_phone_created_idx
  on public.orders (customer_phone, created_at desc);

create index if not exists orders_created_idx
  on public.orders (created_at desc);

create index if not exists orders_paid_at_idx
  on public.orders (paid_at desc);

create index if not exists order_items_order_idx
  on public.order_items (order_id, line_no);

create index if not exists order_events_order_idx
  on public.order_events (order_id, created_at);

create index if not exists menu_items_category_idx
  on public.menu_items (category_id);

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- SADDA DHABA — row-level security and grants
-- The browser never writes orders directly. All order/payment changes go
-- through the RPCs in 0003_rpc.sql.

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select role
  from public.staff
  where id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.is_dev()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.staff
    where id = auth.uid()
      and role = 'dev'
      and active = true
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function public.can_read_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        public.current_staff_role() in ('dev', 'counter')
        or (
          public.current_staff_role() = 'kitchen'
          and o.payment_status = 'PAID'
        )
      )
  );
$$;

alter table public.staff enable row level security;
alter table public.app_settings enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_tokens enable row level security;
alter table public.order_events enable row level security;

-- Staff: each user can read their own row. A fully verified dev can read all.
drop policy if exists staff_read_self_or_dev on public.staff;
create policy staff_read_self_or_dev
on public.staff
for select
to authenticated
using (id = auth.uid() or public.is_dev());

-- Menu is public read; only a fully verified dev can write it directly.
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists categories_dev_write on public.categories;
create policy categories_dev_write
on public.categories
for all
to authenticated
using (public.is_dev())
with check (public.is_dev());

drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read
on public.menu_items
for select
to anon, authenticated
using (true);

drop policy if exists menu_items_dev_write on public.menu_items;
create policy menu_items_dev_write
on public.menu_items
for all
to authenticated
using (public.is_dev())
with check (public.is_dev());

-- Settings are public read; only a fully verified dev can update them.
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read
on public.app_settings
for select
to anon, authenticated
using (true);

drop policy if exists app_settings_dev_update on public.app_settings;
create policy app_settings_dev_update
on public.app_settings
for update
to authenticated
using (public.is_dev())
with check (public.is_dev());

-- Orders: counter/dev see everything; kitchen sees paid orders only.
-- There are deliberately no insert/update/delete policies for clients.
drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read
on public.orders
for select
to authenticated
using (
  public.current_staff_role() in ('dev', 'counter')
  or (
    public.current_staff_role() = 'kitchen'
    and payment_status = 'PAID'
  )
);

drop policy if exists order_items_staff_read on public.order_items;
create policy order_items_staff_read
on public.order_items
for select
to authenticated
using (public.can_read_order(order_id));

drop policy if exists order_events_staff_read on public.order_events;
create policy order_events_staff_read
on public.order_events
for select
to authenticated
using (
  public.current_staff_role() in ('dev', 'counter')
  and public.can_read_order(order_id)
);

-- order_tokens has RLS enabled and no policies. No client role can read it.
-- Only security-definer functions may access token hashes.

revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.categories, public.menu_items, public.app_settings
  to anon, authenticated;

grant select on public.orders, public.order_items, public.order_events, public.staff
  to authenticated;

-- Direct menu writes are required for the dev console. RLS still restricts
-- these grants to a fully verified dev (AAL2). Counter availability changes
-- go through set_menu_item_availability().
grant insert, update, delete on public.categories, public.menu_items
  to authenticated;

grant update on public.app_settings to authenticated;

grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_dev() to authenticated;
grant execute on function public.can_read_order(uuid) to authenticated;

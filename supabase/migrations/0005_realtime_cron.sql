-- SADDA DHABA — realtime and scheduled maintenance
-- Realtime lets the counter and kitchen screens update without a refresh.
-- pg_cron auto-cancels unpaid orders so the counter queue cannot fill up with
-- abandoned checkouts.

alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.menu_items replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
      execute 'alter publication supabase_realtime add table public.orders';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'order_items'
    ) then
      execute 'alter publication supabase_realtime add table public.order_items';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'menu_items'
    ) then
      execute 'alter publication supabase_realtime add table public.menu_items';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'categories'
    ) then
      execute 'alter publication supabase_realtime add table public.categories';
    end if;
  else
    raise notice 'supabase_realtime publication not found; enable Realtime in Supabase and rerun this migration.';
  end if;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'cancel-stale-unpaid-orders';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'cancel-stale-unpaid-orders',
    '*/5 * * * *',
    'select public.cancel_stale_unpaid_orders();'
  );
end;
$$;

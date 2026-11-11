-- SADDA DHABA — remove AAL2/TOTP requirement for dev actions
-- Dev access is granted by an active staff row with role = 'dev' (password login).
-- Apply after 0002_rls.sql on existing databases.

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
  );
$$;

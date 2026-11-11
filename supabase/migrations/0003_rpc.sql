-- SADDA DHABA — server-side order and payment functions
-- All functions are SECURITY DEFINER with a fixed search_path.
-- The browser cannot set prices, totals, payment status, or order status directly.

create or replace function public.generate_order_code()
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  v_alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_i int;
  v_attempt int;
begin
  for v_attempt in 1..20 loop
    v_code := 'SD-';
    for v_i in 1..5 loop
      v_code := v_code || substr(
        v_alphabet,
        1 + floor(random() * length(v_alphabet))::int,
        1
      );
    end loop;
    exit when not exists (
      select 1 from public.orders where order_code = v_code
    );
  end loop;

  if exists (select 1 from public.orders where order_code = v_code) then
    raise exception 'ORDER_CODE_EXHAUSTED';
  end if;

  return v_code;
end;
$$;

create or replace function public.quote_order(p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tax_rate int;
  v_merged_count int;
  v_resolved_count int;
  v_invalid_ids int;
  v_invalid_qtys int;
  v_total_qty int;
  v_subtotal int;
  v_tax int;
  v_total int;
  v_lines jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_ITEM_COUNT';
  end if;

  select tax_rate_bps into v_tax_rate
  from public.app_settings
  where id = true;

  if v_tax_rate is null then
    v_tax_rate := 500;
  end if;

  with raw as (
    select
      case
        when coalesce(x ->> 'menu_item_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (x ->> 'menu_item_id')::uuid
        else null
      end as menu_item_id,
      case
        when jsonb_typeof(x -> 'qty') = 'number'
          and (x ->> 'qty') ~ '^[0-9]{1,3}$'
        then (x ->> 'qty')::int
        else 0
      end as qty
    from jsonb_array_elements(p_items) x
  ),
  merged as (
    select menu_item_id, sum(qty)::int as qty
    from raw
    where menu_item_id is not null
      and qty between 1 and 20
    group by menu_item_id
  ),
  resolved as (
    select
      v.menu_item_id,
      v.qty,
      mi.name,
      mi.price_paise,
      mi.is_veg,
      mi.sort_order
    from merged v
    join public.menu_items mi on mi.id = v.menu_item_id
    where mi.available = true
  )
  select
    (select count(*) from raw where menu_item_id is null),
    (select count(*) from raw
      where menu_item_id is not null and (qty < 1 or qty > 20))
      + (select count(*) from merged where qty > 20),
    (select count(*) from merged),
    (select count(*) from resolved),
    (select coalesce(sum(qty), 0) from merged),
    (select coalesce(sum(price_paise * qty), 0)::int from resolved),
    (select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'menu_item_id', menu_item_id,
          'name', name,
          'unit_price_paise', price_paise,
          'qty', qty,
          'is_veg', is_veg
        )
        order by sort_order, name
      ),
      '[]'::jsonb
    ) from resolved)
  into
    v_invalid_ids,
    v_invalid_qtys,
    v_merged_count,
    v_resolved_count,
    v_total_qty,
    v_subtotal,
    v_lines;

  if v_invalid_ids > 0 then
    raise exception 'INVALID_ITEMS';
  end if;

  if v_invalid_qtys > 0 then
    raise exception 'INVALID_QTY';
  end if;

  if v_merged_count = 0 then
    raise exception 'INVALID_ITEMS';
  end if;

  if v_merged_count <> v_resolved_count then
    raise exception 'ITEM_UNAVAILABLE';
  end if;

  if v_total_qty > 100 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  v_tax := round(v_subtotal * v_tax_rate / 10000.0)::int;
  v_total := v_subtotal + v_tax;

  return jsonb_build_object(
    'subtotal_paise', v_subtotal,
    'tax_paise', v_tax,
    'total_paise', v_total,
    'tax_rate_bps', v_tax_rate,
    'lines', v_lines
  );
end;
$$;

create or replace function public.create_order(
  p_name text,
  p_phone text,
  p_order_type text,
  p_table text,
  p_items jsonb,
  p_notes text,
  p_access_token text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text;
  v_phone text;
  v_type text;
  v_table text;
  v_notes text;
  v_token_hash text;
  v_existing public.orders%rowtype;
  v_quote jsonb;
  v_code text;
  v_order_id uuid;
  v_recent int;
  v_daily int;
  v_pending int;
begin
  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if char_length(v_phone) >= 10 then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  v_type := upper(trim(coalesce(p_order_type, '')));
  if v_type not in ('DINE_IN', 'TAKEAWAY') then
    raise exception 'INVALID_ORDER_TYPE';
  end if;

  v_table := nullif(trim(coalesce(p_table, '')), '');
  if v_table is not null and char_length(v_table) > 20 then
    raise exception 'INVALID_TABLE';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTES';
  end if;

  if p_access_token is null
     or char_length(p_access_token) < 43
     or char_length(p_access_token) > 128
     or p_access_token !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'INVALID_TOKEN';
  end if;

  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_REQUIRED';
  end if;

  v_token_hash := encode(digest(p_access_token, 'sha256'), 'hex');

  select * into v_existing
  from public.orders
  where idempotency_key = p_idempotency_key;

  if found then
    if not exists (
      select 1
      from public.order_tokens
      where order_id = v_existing.id
        and token_hash = v_token_hash
    ) then
      raise exception 'IDEMPOTENCY_MISMATCH';
    end if;

    return jsonb_build_object(
      'order_code', v_existing.order_code,
      'status', v_existing.status,
      'subtotal_paise', v_existing.subtotal_paise,
      'tax_paise', v_existing.tax_paise,
      'total_paise', v_existing.total_paise
    );
  end if;

  select count(*) into v_recent
  from public.orders
  where customer_phone = v_phone
    and created_at > now() - interval '10 minutes';

  if v_recent >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  select count(*) into v_daily
  from public.orders
  where customer_phone = v_phone
    and created_at > now() - interval '24 hours';

  if v_daily >= 10 then
    raise exception 'DAILY_LIMIT';
  end if;

  select count(*) into v_pending
  from public.orders
  where customer_phone = v_phone
    and status = 'AWAITING_PAYMENT';

  if v_pending >= 2 then
    raise exception 'PAYMENT_PENDING';
  end if;

  v_quote := public.quote_order(p_items);
  v_code := public.generate_order_code();

  insert into public.orders (
    order_code,
    idempotency_key,
    customer_name,
    customer_phone,
    order_type,
    table_number,
    status,
    payment_status,
    subtotal_paise,
    tax_paise,
    total_paise,
    notes
  ) values (
    v_code,
    p_idempotency_key,
    v_name,
    v_phone,
    v_type,
    v_table,
    'AWAITING_PAYMENT',
    'UNPAID',
    (v_quote ->> 'subtotal_paise')::int,
    (v_quote ->> 'tax_paise')::int,
    (v_quote ->> 'total_paise')::int,
    v_notes
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    menu_item_id,
    name_snapshot,
    unit_price_paise,
    qty,
    is_veg,
    line_no
  )
  select
    v_order_id,
    (line ->> 'menu_item_id')::uuid,
    line ->> 'name',
    (line ->> 'unit_price_paise')::int,
    (line ->> 'qty')::int,
    (line ->> 'is_veg')::boolean,
    (ord - 1)::int
  from jsonb_array_elements(v_quote -> 'lines') with ordinality as t(line, ord);

  insert into public.order_tokens (order_id, token_hash)
  values (v_order_id, v_token_hash);

  insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
  values (
    v_order_id,
    'ORDER_CREATED',
    null,
    null,
    jsonb_build_object(
      'source', 'customer',
      'order_type', v_type,
      'item_count', jsonb_array_length(v_quote -> 'lines')
    )
  );

  return jsonb_build_object(
    'order_code', v_code,
    'status', 'AWAITING_PAYMENT',
    'subtotal_paise', (v_quote ->> 'subtotal_paise')::int,
    'tax_paise', (v_quote ->> 'tax_paise')::int,
    'total_paise', (v_quote ->> 'total_paise')::int
  );
end;
$$;

create or replace function public.get_order_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
  v_order public.orders%rowtype;
  v_items jsonb;
begin
  if p_token is null
     or char_length(p_token) < 43
     or char_length(p_token) > 128
     or p_token !~ '^[A-Za-z0-9_-]+$' then
    return null;
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select o.* into v_order
  from public.orders o
  join public.order_tokens t on t.order_id = o.id
  where t.token_hash = v_hash;

  if not found then
    return null;
  end if;

  update public.order_tokens
  set last_viewed_at = now()
  where order_id = v_order.id
    and (
      last_viewed_at is null
      or last_viewed_at < now() - interval '5 minutes'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.name_snapshot,
        'unit_price_paise', oi.unit_price_paise,
        'qty', oi.qty,
        'is_veg', oi.is_veg
      )
      order by oi.line_no, oi.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'order_code', v_order.order_code,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'order_type', v_order.order_type,
    'table_number', v_order.table_number,
    'customer_name', v_order.customer_name,
    'items', v_items,
    'subtotal_paise', v_order.subtotal_paise,
    'tax_paise', v_order.tax_paise,
    'total_paise', v_order.total_paise,
    'notes', v_order.notes,
    'created_at', v_order.created_at,
    'paid_at', v_order.paid_at,
    'cancel_reason', v_order.cancel_reason
  );
end;
$$;

create or replace function public.mark_paid(
  p_order_id uuid,
  p_method text,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_method text;
  v_reference text;
begin
  v_role := public.current_staff_role();

  if v_role is null or v_role not in ('counter', 'dev') then
    raise exception 'FORBIDDEN';
  end if;

  v_method := upper(trim(coalesce(p_method, '')));
  if v_method not in ('CASH', 'UPI_COUNTER', 'CARD_COUNTER') then
    raise exception 'INVALID_METHOD';
  end if;

  v_reference := nullif(trim(coalesce(p_reference, '')), '');
  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'INVALID_REFERENCE';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.payment_status = 'PAID' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_code', v_order.order_code,
      'status', v_order.status,
      'payment_status', v_order.payment_status
    );
  end if;

  if v_order.payment_status <> 'UNPAID' or v_order.status <> 'AWAITING_PAYMENT' then
    raise exception 'INVALID_STATE';
  end if;

  update public.orders
  set
    payment_status = 'PAID',
    status = 'QUEUED',
    payment_method = v_method,
    payment_reference = v_reference,
    paid_at = now(),
    paid_by = auth.uid(),
    updated_at = now()
  where id = p_order_id;

  insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
  values (
    p_order_id,
    'PAYMENT_COLLECTED',
    auth.uid(),
    v_role,
    jsonb_build_object(
      'method', v_method,
      'reference', v_reference,
      'amount_paise', v_order.total_paise
    )
  );

  return jsonb_build_object(
    'ok', true,
    'order_code', v_order.order_code,
    'status', 'QUEUED',
    'payment_status', 'PAID'
  );
end;
$$;

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_status text;
  v_allowed boolean := false;
begin
  v_role := public.current_staff_role();

  if v_role is null or v_role not in ('counter', 'kitchen', 'dev') then
    raise exception 'FORBIDDEN';
  end if;

  v_status := upper(trim(coalesce(p_status, '')));

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = v_status then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_code', v_order.order_code,
      'status', v_order.status
    );
  end if;

  if v_order.payment_status <> 'PAID' then
    raise exception 'PAYMENT_REQUIRED';
  end if;

  if v_order.status = 'QUEUED' and v_status = 'PREPARING' then
    v_allowed := true;
  elsif v_order.status = 'PREPARING'
        and v_status = 'READY'
        and v_order.order_type = 'TAKEAWAY' then
    v_allowed := true;
  elsif v_order.status = 'PREPARING'
        and v_status = 'SERVED'
        and v_order.order_type = 'DINE_IN' then
    v_allowed := true;
  elsif v_order.status in ('READY', 'SERVED')
        and v_status = 'COMPLETED'
        and v_role in ('counter', 'dev') then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'INVALID_TRANSITION';
  end if;

  update public.orders
  set status = v_status, updated_at = now()
  where id = p_order_id;

  insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
  values (
    p_order_id,
    'STATUS_CHANGED',
    auth.uid(),
    v_role,
    jsonb_build_object('from', v_order.status, 'to', v_status)
  );

  return jsonb_build_object(
    'ok', true,
    'order_code', v_order.order_code,
    'status', v_status
  );
end;
$$;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_reason text;
begin
  v_role := public.current_staff_role();

  if v_role is null or v_role not in ('counter', 'dev') then
    raise exception 'FORBIDDEN';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if char_length(v_reason) < 3 or char_length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'CANCELLED' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_code', v_order.order_code,
      'status', v_order.status
    );
  end if;

  if v_order.status = 'COMPLETED' then
    raise exception 'INVALID_STATE';
  end if;

  if v_order.payment_status = 'UNPAID' then
    update public.orders
    set
      status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancel_reason = v_reason,
      updated_at = now()
    where id = p_order_id;

    insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
    values (
      p_order_id,
      'ORDER_CANCELLED',
      auth.uid(),
      v_role,
      jsonb_build_object('reason', v_reason)
    );
  elsif v_order.payment_status = 'PAID' then
    if not public.is_dev() then
      raise exception 'REFUND_REQUIRES_DEV';
    end if;

    update public.orders
    set
      status = 'CANCELLED',
      payment_status = 'REFUNDED',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancel_reason = v_reason,
      updated_at = now()
    where id = p_order_id;

    insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
    values (
      p_order_id,
      'ORDER_CANCELLED_REFUNDED',
      auth.uid(),
      v_role,
      jsonb_build_object('reason', v_reason, 'amount_paise', v_order.total_paise)
    );
  else
    raise exception 'INVALID_STATE';
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_code', v_order.order_code,
    'status', 'CANCELLED'
  );
end;
$$;

create or replace function public.refund_order(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_dev() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.payment_status <> 'PAID' then
    raise exception 'NOT_PAID';
  end if;

  return public.cancel_order(p_order_id, p_reason);
end;
$$;

create or replace function public.create_counter_order(
  p_name text,
  p_phone text,
  p_order_type text,
  p_table text,
  p_items jsonb,
  p_notes text,
  p_collect_now boolean,
  p_method text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text;
  v_name text;
  v_phone text;
  v_type text;
  v_table text;
  v_notes text;
  v_quote jsonb;
  v_token text;
  v_token_hash text;
  v_code text;
  v_order_id uuid;
  v_status text;
  v_payment_status text;
  v_method text;
  v_reference text;
begin
  v_role := public.current_staff_role();

  if v_role is null or v_role not in ('counter', 'dev') then
    raise exception 'FORBIDDEN';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := 'Walk-in Guest';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'INVALID_NAME';
  end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if char_length(v_phone) >= 10 then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone = '' then
    v_phone := null;
  elsif v_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  v_type := upper(trim(coalesce(p_order_type, '')));
  if v_type not in ('DINE_IN', 'TAKEAWAY') then
    raise exception 'INVALID_ORDER_TYPE';
  end if;

  v_table := nullif(trim(coalesce(p_table, '')), '');
  if v_table is not null and char_length(v_table) > 20 then
    raise exception 'INVALID_TABLE';
  end if;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTES';
  end if;

  v_quote := public.quote_order(p_items);
  v_code := public.generate_order_code();

  v_token := replace(
    replace(
      replace(encode(gen_random_bytes(32), 'base64'), '+', '-'),
      '/', '_'
    ),
    '=', ''
  );
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  if coalesce(p_collect_now, false) then
    v_method := upper(trim(coalesce(p_method, '')));
    if v_method not in ('CASH', 'UPI_COUNTER', 'CARD_COUNTER') then
      raise exception 'INVALID_METHOD';
    end if;

    v_reference := nullif(trim(coalesce(p_reference, '')), '');
    if v_reference is not null and char_length(v_reference) > 120 then
      raise exception 'INVALID_REFERENCE';
    end if;

    v_status := 'QUEUED';
    v_payment_status := 'PAID';
  else
    v_status := 'AWAITING_PAYMENT';
    v_payment_status := 'UNPAID';
    v_method := null;
    v_reference := null;
  end if;

  insert into public.orders (
    order_code,
    idempotency_key,
    customer_name,
    customer_phone,
    order_type,
    table_number,
    status,
    payment_status,
    payment_method,
    payment_reference,
    subtotal_paise,
    tax_paise,
    total_paise,
    notes,
    paid_at,
    paid_by
  ) values (
    v_code,
    gen_random_uuid(),
    v_name,
    v_phone,
    v_type,
    v_table,
    v_status,
    v_payment_status,
    v_method,
    v_reference,
    (v_quote ->> 'subtotal_paise')::int,
    (v_quote ->> 'tax_paise')::int,
    (v_quote ->> 'total_paise')::int,
    v_notes,
    case when v_payment_status = 'PAID' then now() else null end,
    case when v_payment_status = 'PAID' then auth.uid() else null end
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    menu_item_id,
    name_snapshot,
    unit_price_paise,
    qty,
    is_veg,
    line_no
  )
  select
    v_order_id,
    (line ->> 'menu_item_id')::uuid,
    line ->> 'name',
    (line ->> 'unit_price_paise')::int,
    (line ->> 'qty')::int,
    (line ->> 'is_veg')::boolean,
    (ord - 1)::int
  from jsonb_array_elements(v_quote -> 'lines') with ordinality as t(line, ord);

  insert into public.order_tokens (order_id, token_hash)
  values (v_order_id, v_token_hash);

  insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
  values (
    v_order_id,
    'ORDER_CREATED',
    auth.uid(),
    v_role,
    jsonb_build_object(
      'source', 'counter',
      'order_type', v_type,
      'item_count', jsonb_array_length(v_quote -> 'lines')
    )
  );

  if v_payment_status = 'PAID' then
    insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
    values (
      v_order_id,
      'PAYMENT_COLLECTED',
      auth.uid(),
      v_role,
      jsonb_build_object(
        'method', v_method,
        'reference', v_reference,
        'amount_paise', (v_quote ->> 'total_paise')::int
      )
    );
  end if;

  return jsonb_build_object(
    'order_code', v_code,
    'status', v_status,
    'payment_status', v_payment_status,
    'total_paise', (v_quote ->> 'total_paise')::int,
    'access_token', v_token
  );
end;
$$;

create or replace function public.set_menu_item_availability(
  p_item_id uuid,
  p_available boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text;
  v_id uuid;
begin
  v_role := public.current_staff_role();

  if v_role is null or v_role not in ('counter', 'dev') then
    raise exception 'FORBIDDEN';
  end if;

  update public.menu_items
  set available = coalesce(p_available, false), updated_at = now()
  where id = p_item_id
  returning id into v_id;

  if v_id is null then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'available', p_available);
end;
$$;

create or replace function public.reissue_order_token(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_token text;
  v_token_hash text;
begin
  v_role := public.current_staff_role();

  if v_role is null or v_role not in ('counter', 'dev') then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_token := replace(
    replace(
      replace(encode(gen_random_bytes(32), 'base64'), '+', '-'),
      '/', '_'
    ),
    '=', ''
  );
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.order_tokens (order_id, token_hash)
  values (p_order_id, v_token_hash)
  on conflict (order_id) do update
  set token_hash = excluded.token_hash,
      last_viewed_at = null;

  insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
  values (
    p_order_id,
    'TOKEN_REISSUED',
    auth.uid(),
    v_role,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'order_code', v_order.order_code,
    'access_token', v_token
  );
end;
$$;

create or replace function public.cancel_stale_unpaid_orders()
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_timeout int;
begin
  select unpaid_timeout_minutes into v_timeout
  from public.app_settings
  where id = true;

  if v_timeout is null then
    v_timeout := 30;
  end if;

  with stale as (
    update public.orders
    set
      status = 'CANCELLED',
      cancelled_at = now(),
      cancel_reason = 'Auto-cancelled: payment not received',
      updated_at = now()
    where status = 'AWAITING_PAYMENT'
      and payment_status = 'UNPAID'
      and created_at < now() - make_interval(mins => v_timeout)
    returning id
  )
  insert into public.order_events (order_id, event_type, actor_id, actor_role, details)
  select
    id,
    'AUTO_CANCELLED',
    null,
    'system',
    jsonb_build_object('reason', 'payment timeout')
  from stale;
end;
$$;

revoke all on function public.generate_order_code() from public;
revoke all on function public.quote_order(jsonb) from public;
revoke all on function public.create_order(text, text, text, text, jsonb, text, text, uuid) from public;
revoke all on function public.get_order_by_token(text) from public;
revoke all on function public.mark_paid(uuid, text, text) from public;
revoke all on function public.update_order_status(uuid, text) from public;
revoke all on function public.cancel_order(uuid, text) from public;
revoke all on function public.refund_order(uuid, text) from public;
revoke all on function public.create_counter_order(text, text, text, text, jsonb, text, boolean, text, text) from public;
revoke all on function public.set_menu_item_availability(uuid, boolean) from public;
revoke all on function public.reissue_order_token(uuid) from public;
revoke all on function public.cancel_stale_unpaid_orders() from public;

grant execute on function public.quote_order(jsonb) to anon, authenticated;
grant execute on function public.create_order(text, text, text, text, jsonb, text, text, uuid) to anon, authenticated;
grant execute on function public.get_order_by_token(text) to anon, authenticated;
grant execute on function public.mark_paid(uuid, text, text) to authenticated;
grant execute on function public.update_order_status(uuid, text) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.refund_order(uuid, text) to authenticated;
grant execute on function public.create_counter_order(text, text, text, text, jsonb, text, boolean, text, text) to authenticated;
grant execute on function public.set_menu_item_availability(uuid, boolean) to authenticated;
grant execute on function public.reissue_order_token(uuid) to authenticated;

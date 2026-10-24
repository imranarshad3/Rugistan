-- ============================================================
-- Business logic (prices, stock and totals are server-authoritative)
-- ============================================================

-- Validate a promo code against a subtotal. Never exposes the code table.
create or replace function public.validate_promo(p_code text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.promo_codes%rowtype; disc numeric(12,2);
begin
  select * into c from public.promo_codes
   where upper(code) = upper(trim(p_code)) and is_active
   limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'This promo code is not recognised.');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'This promo code has expired.');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('valid', false, 'reason', 'This promo code has reached its usage limit.');
  end if;
  if p_subtotal < c.min_subtotal then
    return jsonb_build_object('valid', false, 'reason',
      'Spend at least ' || to_char(c.min_subtotal, 'FM999999990.00') || ' to use this code.');
  end if;

  disc := case when c.type = 'percent' then round(p_subtotal * c.value / 100.0, 2) else c.value end;
  disc := least(disc, p_subtotal);

  return jsonb_build_object('valid', true, 'code', c.code, 'discount', disc,
                            'type', c.type, 'value', c.value);
end $$;

-- ------------------------------------------------------------
-- place_order: the single trusted path that creates an order.
-- Client sends only product/variant ids and quantities.
-- ------------------------------------------------------------
create or replace function public.place_order(
  p_items              jsonb,
  p_contact            jsonb,
  p_address            jsonb,
  p_shipping_method_id uuid    default null,
  p_payment_method     text    default '',
  p_promo_code         text    default null,
  p_note               text    default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it            jsonb;
  prod          public.products%rowtype;
  var           public.product_variants%rowtype;
  qty           int;
  available     int;
  unit          numeric(12,2);
  v_subtotal    numeric(12,2) := 0;
  v_shipping    numeric(12,2) := 0;
  v_discount    numeric(12,2) := 0;
  v_ship_name   text := '';
  v_promo       jsonb;
  v_promo_code  text := null;
  v_order_id    uuid;
  v_number      text;
  v_currency    text;
  v_payments    jsonb;
  v_pay         jsonb;
  v_pay_label   text;
  v_pay_status  public.payment_status;
  v_image       text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  -- ---- payment method must be one the store has actually enabled ----
  select coalesce(value, '{}'::jsonb) into v_payments from public.settings where key = 'payments';
  v_pay := (
    select m from jsonb_array_elements(coalesce(v_payments->'offline_methods','[]'::jsonb)) m
     where m->>'id' = p_payment_method and coalesce((m->>'enabled')::boolean, false)
     limit 1
  );
  if v_pay is null then
    raise exception 'The selected payment method is not available. No payment provider is configured for this store yet.'
      using errcode = 'P0001';
  end if;
  v_pay_label  := coalesce(v_pay->>'label', p_payment_method);
  v_pay_status := case when coalesce(v_pay->>'marks_as','unpaid') = 'awaiting_confirmation'
                       then 'awaiting_confirmation'::public.payment_status
                       else 'unpaid'::public.payment_status end;

  -- ---- shipping ----
  if p_shipping_method_id is not null then
    select name, amount into v_ship_name, v_shipping
      from public.shipping_methods where id = p_shipping_method_id and is_active;
    if v_ship_name is null then
      raise exception 'The selected delivery method is no longer available.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Please choose a delivery method.' using errcode = 'P0001';
  end if;

  select coalesce(value->>'currency','USD') into v_currency from public.settings where key = 'store';
  v_currency := coalesce(v_currency, 'USD');

  v_number := 'RG-' || nextval('public.order_number_seq')::text;

  insert into public.orders (
    order_number, user_id, email, first_name, last_name, phone,
    address_line1, address_line2, city, province, postal_code, country,
    shipping_method, payment_method, status, payment_status,
    currency, customer_note
  ) values (
    v_number, public.current_user_id(),
    lower(trim(coalesce(p_contact->>'email',''))),
    trim(coalesce(p_contact->>'first_name','')),
    trim(coalesce(p_contact->>'last_name','')),
    trim(coalesce(p_contact->>'phone','')),
    trim(coalesce(p_address->>'address_line1','')),
    trim(coalesce(p_address->>'address_line2','')),
    trim(coalesce(p_address->>'city','')),
    trim(coalesce(p_address->>'province','')),
    trim(coalesce(p_address->>'postal_code','')),
    trim(coalesce(p_address->>'country','')),
    v_ship_name, v_pay_label, 'pending', v_pay_status,
    v_currency, coalesce(p_note,'')
  ) returning id into v_order_id;

  -- ---- line items: lock rows, verify stock, price from the database ----
  for it in select * from jsonb_array_elements(p_items) loop
    qty := greatest(coalesce((it->>'quantity')::int, 0), 0);
    if qty = 0 then continue; end if;

    select * into prod from public.products
      where id = (it->>'product_id')::uuid for update;
    if not found or prod.status <> 'published' then
      raise exception 'A rug in your cart is no longer available.' using errcode = 'P0001';
    end if;

    var := null;
    if nullif(it->>'variant_id','') is not null then
      select * into var from public.product_variants
        where id = (it->>'variant_id')::uuid and product_id = prod.id for update;
      if not found or not var.is_active then
        raise exception 'The chosen size for "%" is no longer available.', prod.name using errcode = 'P0001';
      end if;
    end if;

    available := case when var.id is not null then var.stock_quantity else prod.stock_quantity end;
    if qty > available then
      raise exception 'Only % left in stock for "%".', available, prod.name using errcode = 'P0001';
    end if;

    unit := prod.price + coalesce(var.price_delta, 0);
    v_subtotal := v_subtotal + (unit * qty);

    select url into v_image from public.product_images
      where product_id = prod.id order by sort_order, created_at limit 1;

    insert into public.order_items (order_id, product_id, variant_id, product_name,
                                    size_label, image_url, unit_price, quantity, line_total)
    values (v_order_id, prod.id, var.id, prod.name,
            coalesce(var.label,''), v_image, unit, qty, unit * qty);

    if var.id is not null then
      update public.product_variants set stock_quantity = stock_quantity - qty where id = var.id;
      update public.products set stock_quantity = greatest(stock_quantity - qty, 0) where id = prod.id;
    else
      update public.products set stock_quantity = stock_quantity - qty where id = prod.id;
    end if;
  end loop;

  if v_subtotal = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  -- ---- promo ----
  if nullif(trim(coalesce(p_promo_code,'')),'') is not null then
    v_promo := public.validate_promo(p_promo_code, v_subtotal);
    if coalesce((v_promo->>'valid')::boolean, false) then
      v_discount   := (v_promo->>'discount')::numeric;
      v_promo_code := v_promo->>'code';
      update public.promo_codes set used_count = used_count + 1
        where upper(code) = upper(v_promo_code);
    end if;
  end if;

  update public.orders set
    subtotal = v_subtotal,
    shipping_amount = v_shipping,
    discount_amount = v_discount,
    total = greatest(v_subtotal + v_shipping - v_discount, 0),
    promo_code = v_promo_code
  where id = v_order_id;

  insert into public.order_events (order_id, label, note)
  values (v_order_id, 'Order Placed', 'Order received via the Rugistan storefront.');

  if public.current_user_id() is not null then
    delete from public.cart_items where user_id = public.current_user_id();
  end if;

  return (select jsonb_build_object(
            'id', o.id, 'order_number', o.order_number,
            'total', o.total, 'currency', o.currency,
            'payment_method', o.payment_method,
            'payment_instructions', coalesce(v_pay->>'instructions',''))
          from public.orders o where o.id = v_order_id);
end $$;

revoke all on function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text) from public;
grant execute on function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text) to anon, authenticated;

-- ------------------------------------------------------------
-- Track an order without an account (order number + email)
-- ------------------------------------------------------------
create or replace function public.track_order(p_order_number text, p_email text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders
   where upper(order_number) = upper(trim(p_order_number))
     and lower(email) = lower(trim(p_email));
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'order', jsonb_build_object(
      'order_number', o.order_number, 'status', o.status,
      'payment_status', o.payment_status, 'total', o.total,
      'currency', o.currency, 'created_at', o.created_at,
      'shipping_method', o.shipping_method, 'city', o.city, 'country', o.country),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
                'product_name', i.product_name, 'size_label', i.size_label,
                'quantity', i.quantity, 'line_total', i.line_total, 'image_url', i.image_url))
              from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
                'label', e.label, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
              from public.order_events e where e.order_id = o.id), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------
-- Admin analytics — every number derives from real rows
-- ------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare span interval; pf timestamptz; pt timestamptz; res jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  span := p_to - p_from; pf := p_from - span; pt := p_from;

  select jsonb_build_object(
    'revenue',        coalesce((select sum(total) from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to), 0),
    'revenue_prev',   coalesce((select sum(total) from public.orders where status <> 'cancelled' and created_at >= pf and created_at < pt), 0),
    'orders',         (select count(*) from public.orders where created_at >= p_from and created_at < p_to),
    'orders_prev',    (select count(*) from public.orders where created_at >= pf and created_at < pt),
    'customers',      (select count(*) from public.profiles where role = 'customer'),
    'customers_new',  (select count(*) from public.profiles where role = 'customer' and created_at >= p_from and created_at < p_to),
    'customers_prev', (select count(*) from public.profiles where role = 'customer' and created_at >= pf and created_at < pt),
    'reviews_new',    (select count(*) from public.reviews where created_at >= p_from and created_at < p_to),
    'reviews_prev',   (select count(*) from public.reviews where created_at >= pf and created_at < pt),
    'reviews_pending',(select count(*) from public.reviews where status = 'pending'),
    'reviews_total',  (select count(*) from public.reviews),
    'reviews_published',(select count(*) from public.reviews where status = 'published'),
    'rating_avg',     coalesce((select round(avg(rating)::numeric,1) from public.reviews where status = 'published'), 0),
    'low_stock',      (select count(*) from public.products where status = 'published' and stock_quantity <= low_stock_at),
    'products_total', (select count(*) from public.products),
    'repeat_rate',    coalesce((
        select round(100.0 * count(*) filter (where c > 1) / nullif(count(*),0), 1)
        from (select user_id, count(*) c from public.orders where user_id is not null group by user_id) t), 0),
    'aov',            coalesce((select round(avg(total),2) from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to), 0),
    'by_status',      coalesce((select jsonb_object_agg(status, n) from
                        (select status::text, count(*) n from public.orders group by status) s), '{}'::jsonb)
  ) into res;
  return res;
end $$;

create or replace function public.admin_sales_series(p_from timestamptz, p_to timestamptz, p_bucket text default 'month')
returns table (bucket timestamptz, revenue numeric, orders bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  return query
  with grid as (
    select generate_series(date_trunc(p_bucket, p_from), date_trunc(p_bucket, p_to), ('1 ' || p_bucket)::interval) as b
  )
  select g.b,
         coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::numeric,
         count(o.id)
    from grid g
    left join public.orders o
      on date_trunc(p_bucket, o.created_at) = g.b
     and o.created_at >= p_from and o.created_at < p_to
   group by g.b order by g.b;
end $$;

create or replace function public.admin_top_products(p_from timestamptz, p_to timestamptz, p_limit int default 4)
returns table (product_id uuid, name text, image_url text, units bigint, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  return query
  select i.product_id, max(i.product_name), max(i.image_url),
         sum(i.quantity)::bigint, sum(i.line_total)::numeric
    from public.order_items i
    join public.orders o on o.id = i.order_id
   where o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to
     and i.product_id is not null
   group by i.product_id
   order by sum(i.quantity) desc
   limit p_limit;
end $$;

create or replace function public.admin_top_categories(p_from timestamptz, p_to timestamptz, p_limit int default 4)
returns table (category_id uuid, name text, image_url text, units bigint, revenue numeric, share numeric)
language plpgsql stable security definer set search_path = public as $$
declare total numeric;
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;

  select coalesce(sum(i.line_total),0) into total
    from public.order_items i join public.orders o on o.id = i.order_id
   where o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to;

  return query
  select c.id, c.name, c.image_url,
         sum(i.quantity)::bigint, sum(i.line_total)::numeric,
         case when total > 0 then round(100.0 * sum(i.line_total) / total, 1) else 0 end
    from public.order_items i
    join public.orders o   on o.id = i.order_id
    join public.products p on p.id = i.product_id
    join public.categories c on c.id = p.category_id
   where o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to
   group by c.id, c.name, c.image_url
   order by sum(i.line_total) desc
   limit p_limit;
end $$;

-- customer directory with real aggregates
create or replace function public.admin_customers(p_search text default '')
returns table (id text, email text, first_name text, last_name text, phone text,
               created_at timestamptz, orders_count bigint, total_spent numeric, last_order_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  return query
  select p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at,
         count(o.id)::bigint,
         coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::numeric,
         max(o.created_at)
    from public.profiles p
    left join public.orders o on o.user_id = p.id
   where p.role = 'customer'
     and (coalesce(p_search,'') = ''
          or p.email ilike '%'||p_search||'%'
          or (p.first_name || ' ' || p.last_name) ilike '%'||p_search||'%')
   group by p.id
   order by p.created_at desc;
end $$;

-- admin changes an order's status and records it on the timeline
create or replace function public.admin_set_order_status(p_order_id uuid, p_status public.order_status, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare cur public.order_status;
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  select status into cur from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0001'; end if;
  if cur = p_status then return; end if;

  -- restock when an order is cancelled
  if p_status = 'cancelled' and cur <> 'cancelled' then
    update public.products p set stock_quantity = p.stock_quantity + i.quantity
      from public.order_items i where i.order_id = p_order_id and i.product_id = p.id;
    update public.product_variants v set stock_quantity = v.stock_quantity + i.quantity
      from public.order_items i where i.order_id = p_order_id and i.variant_id = v.id;
  end if;

  update public.orders set status = p_status where id = p_order_id;
  insert into public.order_events (order_id, label, note)
  values (p_order_id,
          (case p_status when 'pending' then 'Order Placed' when 'processing' then 'Processing'
                         when 'shipped' then 'Shipped' when 'delivered' then 'Delivered'
                         else 'Cancelled' end),
          coalesce(p_note,''));
end $$;

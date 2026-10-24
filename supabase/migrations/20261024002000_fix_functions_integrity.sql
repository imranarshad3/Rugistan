-- ============================================================
-- Rugistan Handmade Rugs — Function Integrity & Analytics Fixes
-- ============================================================

-- 1. Restock with aggregated line items upon cancellation, and prevent reopening cancelled orders
create or replace function public.admin_set_order_status(p_order_id uuid, p_status public.order_status, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare cur public.order_status;
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  select status into cur from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0001'; end if;
  if cur = p_status then return; end if;

  if cur = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'Cancelled orders cannot be reopened.' using errcode = 'P0001';
  end if;

  -- restock with aggregated quantities when an order is cancelled
  if p_status = 'cancelled' and cur <> 'cancelled' then
    update public.products p
       set stock_quantity = p.stock_quantity + agg.qty
      from (
        select product_id, sum(quantity) as qty
          from public.order_items
         where order_id = p_order_id and product_id is not null
         group by product_id
      ) agg
     where p.id = agg.product_id;

    update public.product_variants v
       set stock_quantity = v.stock_quantity + agg.qty
      from (
        select variant_id, sum(quantity) as qty
          from public.order_items
         where order_id = p_order_id and variant_id is not null
         group by variant_id
      ) agg
     where v.id = agg.variant_id;
  end if;

  update public.orders set status = p_status where id = p_order_id;
  insert into public.order_events (order_id, label, note)
  values (p_order_id,
          (case p_status when 'pending' then 'Order Placed' when 'processing' then 'Processing'
                         when 'shipped' then 'Shipped' when 'delivered' then 'Delivered'
                         else 'Cancelled' end),
          coalesce(p_note,''));
end $$;

-- 2. admin_sales_series: exclude cancelled orders from count
drop function if exists public.admin_sales_series(timestamptz, timestamptz, text);
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
         count(o.id) filter (where o.status <> 'cancelled')
     from grid g
    left join public.orders o
      on date_trunc(p_bucket, o.created_at) = g.b
     and o.created_at >= p_from and o.created_at < p_to
   group by g.b order by g.b;
end $$;

-- 3. admin_dashboard_stats: exclude cancelled orders from order metrics
create or replace function public.admin_dashboard_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare span interval; pf timestamptz; pt timestamptz; res jsonb;
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  span := p_to - p_from; pf := p_from - span; pt := p_from;

  select jsonb_build_object(
    'revenue',        coalesce((select sum(total) from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to), 0),
    'revenue_prev',   coalesce((select sum(total) from public.orders where status <> 'cancelled' and created_at >= pf and created_at < pt), 0),
    'orders',         (select count(*) from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to),
    'orders_prev',    (select count(*) from public.orders where status <> 'cancelled' and created_at >= pf and created_at < pt),
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
        from (select user_id, count(*) filter (where status <> 'cancelled') as c from public.orders where user_id is not null group by user_id) t), 0),
    'aov',            coalesce((select round(avg(total),2) from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to), 0),
    'by_status',      coalesce((select jsonb_object_agg(status, n) from
                        (select status::text, count(*) n from public.orders group by status) s), '{}'::jsonb)
  ) into res;
  return res;
end $$;

-- 4. admin_customers: accurate active orders count and last_order_at
drop function if exists public.admin_customers(text);
create or replace function public.admin_customers(p_search text default '')
returns table (id text, email text, first_name text, last_name text, phone text,
               created_at timestamptz, orders_count bigint, total_spent numeric, last_order_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  return query
  select p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at,
         count(o.id) filter (where o.status <> 'cancelled')::bigint,
         coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::numeric,
         max(o.created_at) filter (where o.status <> 'cancelled')
    from public.profiles p
    left join public.orders o on o.user_id = p.id
   where p.role = 'customer'
     and (coalesce(p_search,'') = ''
          or p.email ilike '%'||p_search||'%'
          or (p.first_name || ' ' || p.last_name) ilike '%'||p_search||'%')
   group by p.id
   order by p.created_at desc;
end $$;

-- 5. track_order: include order item id
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
                'id', i.id,
                'product_name', i.product_name, 'size_label', i.size_label,
                'quantity', i.quantity, 'line_total', i.line_total, 'image_url', i.image_url))
              from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
                'label', e.label, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
              from public.order_events e where e.order_id = o.id), '[]'::jsonb)
  );
end $$;

grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.admin_set_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.admin_sales_series(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.admin_dashboard_stats(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_customers(text) to authenticated;

notify pgrst, 'reload schema';

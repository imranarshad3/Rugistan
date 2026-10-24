-- Avoid collision between the local aggregate and orders.total.
create or replace function public.admin_top_categories(p_from timestamptz, p_to timestamptz, p_limit int default 4)
returns table (category_id uuid, name text, image_url text, units bigint, revenue numeric, share numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_total numeric;
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;

  select coalesce(sum(i.line_total),0) into v_total
    from public.order_items i join public.orders o on o.id = i.order_id
   where o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to;

  return query
  select c.id, c.name, c.image_url,
         sum(i.quantity)::bigint, sum(i.line_total)::numeric,
         case when v_total > 0 then round(100.0 * sum(i.line_total) / v_total, 1) else 0 end
    from public.order_items i
    join public.orders o   on o.id = i.order_id
    join public.products p on p.id = i.product_id
    join public.categories c on c.id = p.category_id
   where o.status <> 'cancelled' and o.created_at >= p_from and o.created_at < p_to
   group by c.id, c.name, c.image_url
   order by sum(i.line_total) desc
   limit p_limit;
end $$;

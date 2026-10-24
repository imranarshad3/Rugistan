-- Anonymous session counts, without collecting names, addresses or IPs.
create table public.product_views (
  product_id uuid not null references public.products(id) on delete cascade,
  session_key uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (product_id, session_key)
);
alter table public.product_views enable row level security;
grant insert on public.product_views to anon, authenticated;
grant select on public.product_views to authenticated;
create policy "published product view insert" on public.product_views for insert to anon, authenticated
with check (exists(select 1 from public.products p where p.id = product_id and p.status = 'published') and viewed_at = now());
create policy "admin view counts read" on public.product_views for select to authenticated using (public.is_admin());
create function public.admin_product_views()
returns table(product_id uuid, views bigint)
language sql stable security invoker set search_path = public
as $$ select v.product_id, count(*) from public.product_views v group by v.product_id $$;
revoke all on function public.admin_product_views() from public, anon;
grant execute on function public.admin_product_views() to authenticated;
notify pgrst, 'reload schema';

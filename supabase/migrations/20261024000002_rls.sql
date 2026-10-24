-- ============================================================
-- Row level security
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.product_variants      enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.cart_items            enable row level security;
alter table public.shipping_methods      enable row level security;
alter table public.promo_codes           enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_events          enable row level security;
alter table public.reviews               enable row level security;
alter table public.banners               enable row level security;
alter table public.pages                 enable row level security;
alter table public.settings              enable row level security;
alter table public.contact_messages      enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Explicit table privileges are paired with RLS below.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- profiles -----------------------------------------------------
create policy "profiles self insert" on public.profiles for insert to authenticated
  with check (id = public.current_user_id() and role = 'customer');
create policy "profiles self read"   on public.profiles for select using (id = public.current_user_id() or public.is_admin());
create policy "profiles self update" on public.profiles for update using (id = public.current_user_id()) with check (id = public.current_user_id() and role = 'customer');
create policy "profiles admin all"   on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- catalogue (public read of live content, admin writes) ---------
create policy "categories public read" on public.categories for select using (is_active or public.is_admin());
create policy "categories admin write" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products public read" on public.products for select using (status = 'published' or public.is_admin());
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "product_images public read" on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or public.is_admin())));
create policy "product_images admin write" on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy "product_variants public read" on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or public.is_admin())));
create policy "product_variants admin write" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

create policy "shipping public read" on public.shipping_methods for select using (is_active or public.is_admin());
create policy "shipping admin write" on public.shipping_methods for all using (public.is_admin()) with check (public.is_admin());

-- promo codes are never publicly listable; validated through an RPC
create policy "promos admin only" on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());

-- wishlist / cart ----------------------------------------------
create policy "wishlist owner" on public.wishlist_items for all
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());

create policy "cart owner" on public.cart_items for all
  using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());

-- orders --------------------------------------------------------
create policy "orders owner read" on public.orders for select using (user_id = public.current_user_id() or public.is_admin());
create policy "orders admin write" on public.orders for all using (public.is_admin()) with check (public.is_admin());

create policy "order_items read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = public.current_user_id() or public.is_admin())));
create policy "order_items admin write" on public.order_items for all using (public.is_admin()) with check (public.is_admin());

create policy "order_events read" on public.order_events for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = public.current_user_id() or public.is_admin())));
create policy "order_events admin write" on public.order_events for all using (public.is_admin()) with check (public.is_admin());

-- reviews -------------------------------------------------------
create policy "reviews public read" on public.reviews for select
  using (status = 'published' or user_id = public.current_user_id() or public.is_admin());
create policy "reviews author insert" on public.reviews for insert
  with check (user_id = public.current_user_id() and status = 'pending');
create policy "reviews admin write" on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- CMS -----------------------------------------------------------
create policy "banners public read" on public.banners for select using (is_active or public.is_admin());
create policy "banners admin write" on public.banners for all using (public.is_admin()) with check (public.is_admin());

create policy "pages public read" on public.pages for select using (status = 'published' or public.is_admin());
create policy "pages admin write" on public.pages for all using (public.is_admin()) with check (public.is_admin());

create policy "settings public read" on public.settings for select using (true);
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- inbound -------------------------------------------------------
create policy "contact insert any" on public.contact_messages for insert with check (true);
create policy "contact admin read" on public.contact_messages for all using (public.is_admin()) with check (public.is_admin());

create policy "newsletter insert any" on public.newsletter_subscribers for insert with check (true);
create policy "newsletter admin read" on public.newsletter_subscribers for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Storage
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', true, 8388608, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml'])
on conflict (id) do nothing;

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media admin insert" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy "media admin update" on storage.objects for update using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
create policy "media admin delete" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- ============================================================
-- Rugistan Handmade Rugs — core schema
-- ============================================================
create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(unaccent(coalesce(txt,''))), '[^a-z0-9]+', '-', 'g'))
$$;

-- Clerk session subjects are strings such as user_..., not Supabase Auth UUIDs.
create or replace function public.current_user_id()
returns text language sql stable set search_path = public as $$
  select nullif(auth.jwt()->>'sub', '')
$$;

-- ---------- profiles ----------
create type public.user_role as enum ('customer','admin');

create table public.profiles (
  id          text primary key,
  email       text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  phone       text not null default '',
  avatar_url  text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = public.current_user_id() and p.role = 'admin')
$$;

-- ---------- catalogue ----------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  image_url   text,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create type public.product_status as enum ('draft','published','archived');

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  sku               text not null unique,
  short_description text not null default '',
  description       text not null default '',
  category_id       uuid references public.categories(id) on delete set null,
  price             numeric(12,2) not null check (price >= 0),
  compare_at_price  numeric(12,2) check (compare_at_price >= 0),
  stock_quantity    int not null default 0 check (stock_quantity >= 0),
  low_stock_at      int not null default 3,
  material          text not null default '',
  dimensions        text not null default '',
  weave_technique   text not null default '',
  color             text not null default '',
  colors            jsonb not null default '[]'::jsonb,
  room              text not null default '',
  style             text not null default '',
  status            public.product_status not null default 'draft',
  is_featured       boolean not null default false,
  rating_avg        numeric(3,2) not null default 0,
  rating_count      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.products (status);
create index on public.products (category_id);
create index on public.products (is_featured);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.product_images (product_id, sort_order);

-- size variants: each carries its own stock + price delta
create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  label          text not null,
  price_delta    numeric(12,2) not null default 0,
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  unique (product_id, label)
);
create index on public.product_variants (product_id, sort_order);

-- ---------- wishlist + persistent cart ----------
create table public.wishlist_items (
  user_id    text not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity   int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cart_items_unique on public.cart_items (user_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create trigger cart_items_updated before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ---------- shipping / promos ----------
create table public.shipping_methods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  is_active   boolean not null default true,
  sort_order  int not null default 0
);

create type public.promo_type as enum ('percent','fixed');

create table public.promo_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  type         public.promo_type not null default 'percent',
  value        numeric(12,2) not null check (value > 0),
  min_subtotal numeric(12,2) not null default 0,
  is_active    boolean not null default true,
  expires_at   timestamptz,
  usage_limit  int,
  used_count   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- orders ----------
create type public.order_status   as enum ('pending','processing','shipped','delivered','cancelled');
create type public.payment_status as enum ('unpaid','awaiting_confirmation','paid','refunded','failed');

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  user_id         text references public.profiles(id) on delete set null,
  email           text not null,
  first_name      text not null,
  last_name       text not null,
  phone           text not null default '',
  address_line1   text not null,
  address_line2   text not null default '',
  city            text not null,
  province        text not null default '',
  postal_code     text not null default '',
  country         text not null,
  shipping_method text not null default '',
  payment_method  text not null default '',
  status          public.order_status   not null default 'pending',
  payment_status  public.payment_status not null default 'unpaid',
  subtotal        numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  currency        text not null default 'USD',
  promo_code      text,
  customer_note   text not null default '',
  admin_note      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.orders (user_id);
create index on public.orders (status);
create index on public.orders (created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  variant_id   uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  size_label   text not null default '',
  image_url    text,
  unit_price   numeric(12,2) not null,
  quantity     int not null check (quantity > 0),
  line_total   numeric(12,2) not null
);
create index on public.order_items (order_id);

create table public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  label      text not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);

-- order number sequence
create sequence public.order_number_seq start 1001;

-- ---------- reviews ----------
create type public.review_status as enum ('pending','published','rejected');

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     text references public.profiles(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  author_name text not null,
  rating      int not null check (rating between 1 and 5),
  title       text not null default '',
  body        text not null default '',
  status      public.review_status not null default 'pending',
  admin_reply text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.reviews (product_id, status);
create trigger reviews_updated before update on public.reviews
  for each row execute function public.set_updated_at();

-- keep product rating aggregates in sync with published reviews
create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update public.products p set
    rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r
                            where r.product_id = pid and r.status = 'published'), 0),
    rating_count = (select count(*) from public.reviews r
                     where r.product_id = pid and r.status = 'published')
  where p.id = pid;
  return null;
end $$;

create trigger reviews_rating_sync
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ---------- CMS ----------
create table public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text not null default '',
  eyebrow    text not null default '',
  placement  text not null default 'home_hero',
  image_url  text,
  link_url   text not null default '',
  cta_label  text not null default '',
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger banners_updated before update on public.banners
  for each row execute function public.set_updated_at();

create type public.page_status as enum ('draft','published');

create table public.pages (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  content          text not null default '',
  meta_title       text not null default '',
  meta_description text not null default '',
  hero_image_url   text,
  hero_heading     text not null default '',
  status           public.page_status not null default 'draft',
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger pages_updated before update on public.pages
  for each row execute function public.set_updated_at();

create table public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------- inbound messages ----------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null default '',
  email      text not null,
  phone      text not null default '',
  topic      text not null default '',
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  created_at timestamptz not null default now()
);

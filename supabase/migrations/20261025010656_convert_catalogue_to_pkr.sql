-- One-time merchant-authorized conversion. Quote: ExchangeRate-API, 2026-10-25 00:02:31 UTC.
-- Existing order currencies are immutable; abort if orders have appeared since preflight.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.settings, public.products, public.product_variants,
  public.shipping_methods, public.promo_codes, public.orders in access exclusive mode;
create table if not exists private.currency_conversion_backups (
  id text primary key,
  created_at timestamptz not null default now(),
  snapshot jsonb not null
);
alter table private.currency_conversion_backups enable row level security;
revoke all on private.currency_conversion_backups from public, anon, authenticated;

do $conversion$
declare rate constant numeric := 276.820884; base text;
begin
  select value->>'currency' into base from public.settings where key='store';
  if base is null and not exists(select 1 from public.products) then
    raise notice 'Fresh database: no catalogue currency to convert.'; return;
  end if;
  if base='PKR' and exists(select 1 from private.currency_conversion_backups where id='usd-pkr-20261025') then
    raise notice 'PKR conversion already applied.'; return;
  end if;
  if base is distinct from 'USD' then raise exception 'Expected USD store base; conversion aborted.'; end if;
  if exists(select 1 from public.orders) then
    raise exception 'Orders exist: review historical analytics before changing base currency.';
  end if;
  insert into private.currency_conversion_backups(id,snapshot) values('usd-pkr-20261025',jsonb_build_object(
    'rate',rate,'source','https://open.er-api.com/v6/latest/USD','quoted_at','2026-10-25T00:02:31Z',
    'store',(select value from public.settings where key='store'),
    'products',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'price',price,'compare_at_price',compare_at_price)),'[]') from public.products),
    'variants',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'product_id',product_id,'price_delta',price_delta)),'[]') from public.product_variants),
    'shipping',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount)),'[]') from public.shipping_methods),
    'promos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'value',value,'min_subtotal',min_subtotal)),'[]') from public.promo_codes)
  ));
  -- Round each final size price, rather than accumulating rounding errors in deltas.
  update public.product_variants v set price_delta=round((p.price+v.price_delta)*rate)-round(p.price*rate)
    from public.products p where p.id=v.product_id;
  update public.products set price=round(price*rate),compare_at_price=round(compare_at_price*rate);
  update public.shipping_methods set amount=round(amount*rate);
  update public.promo_codes set value=case when type='fixed' then greatest(1,round(value*rate)) else value end,
    min_subtotal=round(min_subtotal*rate);
  -- Bypass only this guard, under an exclusive transaction lock; restore it before commit.
  alter table public.settings disable trigger settings_protect_currency;
  update public.settings set value=value || jsonb_build_object('currency','PKR','currency_symbol','Rs ',
    'price_filter_limits',jsonb_build_array(round(300*rate),round(500*rate)),
    'currency_conversion',jsonb_build_object('from','USD','rate',rate,'date','2026-10-25')) where key='store';
  alter table public.settings enable trigger settings_protect_currency;
end $conversion$;

alter table public.products add constraint products_whole_price check(price=trunc(price) and (compare_at_price is null or compare_at_price=trunc(compare_at_price)));
alter table public.product_variants add constraint variants_whole_price_delta check(price_delta=trunc(price_delta));
alter table public.shipping_methods add constraint shipping_whole_amount check(amount=trunc(amount));
alter table public.promo_codes add constraint promos_whole_amount check(min_subtotal=trunc(min_subtotal) and (type<>'fixed' or value=trunc(value)));

create or replace function public.validate_promo(p_code text,p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path=public as $promo$
declare c public.promo_codes%rowtype; disc numeric(12,2); whole boolean;
begin
  select * into c from public.promo_codes where upper(code)=upper(trim(p_code)) and is_active limit 1;
  if not found then return jsonb_build_object('valid',false,'reason','This promo code is not recognised.'); end if;
  if c.expires_at is not null and c.expires_at<now() then return jsonb_build_object('valid',false,'reason','This promo code has expired.'); end if;
  if c.usage_limit is not null and c.used_count>=c.usage_limit then return jsonb_build_object('valid',false,'reason','This promo code has reached its usage limit.'); end if;
  select coalesce(value->>'currency','USD')='PKR' into whole from public.settings where key='store';
  if p_subtotal<c.min_subtotal then return jsonb_build_object('valid',false,'reason','Spend at least '||to_char(c.min_subtotal,case when whole then 'FM999999999990' else 'FM999999990.00' end)||' to use this code.'); end if;
  disc:=case when c.type='percent' then round(p_subtotal*c.value/100.0,case when whole then 0 else 2 end) else c.value end;
  disc:=least(disc,p_subtotal);
  return jsonb_build_object('valid',true,'code',c.code,'discount',disc,'type',c.type,'value',c.value);
end $promo$;
-- CREATE OR REPLACE preserves the existing execute grants and security boundary.
commit;

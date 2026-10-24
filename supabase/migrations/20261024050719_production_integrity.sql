-- Atomic account cart synchronization. A failed replacement rolls back completely.
create or replace function public.sync_cart(p_lines jsonb, p_merge boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user text := public.current_user_id(); it jsonb; v_product uuid; v_variant uuid; v_qty int;
begin
  if v_user is null then raise exception 'Please sign in and try again.'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 50 then
    raise exception 'A cart can contain up to 50 lines.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cart:' || v_user, 0));
  if not p_merge then delete from public.cart_items where user_id = v_user; end if;
  for it in select * from jsonb_array_elements(p_lines) loop
    v_product := (it->>'product_id')::uuid;
    v_variant := nullif(it->>'variant_id','')::uuid;
    if coalesce(it->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid cart quantity.'; end if;
    v_qty := (it->>'quantity')::int;
    if v_qty < 1 or v_qty > 99 then raise exception 'Invalid cart quantity.'; end if;
    if not exists(select 1 from public.products where id=v_product and status='published') then
      if p_merge then continue; end if;
      raise exception 'A rug in your cart is no longer available.';
    end if;
    if v_variant is not null and not exists(select 1 from public.product_variants where id=v_variant and product_id=v_product and is_active) then
      if p_merge then continue; end if;
      raise exception 'That size is no longer available.';
    end if;
    if v_variant is null and exists(select 1 from public.product_variants where product_id=v_product) then
      if p_merge then continue; end if;
      raise exception 'Please choose a size for this rug.';
    end if;
    update public.cart_items set quantity=greatest(quantity,v_qty)
      where user_id=v_user and product_id=v_product and variant_id is not distinct from v_variant;
    if not found then insert into public.cart_items(user_id,product_id,variant_id,quantity)
      values(v_user,v_product,v_variant,v_qty); end if;
  end loop;
  if (select count(*) from public.cart_items where user_id=v_user) > 50 then raise exception 'A cart can contain up to 50 lines.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'variant_id',variant_id,'quantity',quantity))
    from public.cart_items where user_id=v_user),'[]'::jsonb);
end $$;
revoke all on function public.sync_cart(jsonb,boolean) from public,anon;
grant execute on function public.sync_cart(jsonb,boolean) to authenticated;

alter table public.orders add column request_id uuid unique;
alter table public.orders add column reservation_expires_at timestamptz;
drop function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text);
create function public.place_order(
  p_items              jsonb,
  p_contact            jsonb,
  p_address            jsonb,
  p_shipping_method_id uuid    default null,
  p_payment_method     text    default '',
  p_promo_code         text    default null,
  p_note               text    default '',
  p_request_id         uuid    default null
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
  v_promo_row public.promo_codes%rowtype;
  v_existing public.orders%rowtype;
  v_email text := lower(trim(coalesce(p_contact->>'email','')));
begin
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('request:' || p_request_id::text,0));
    select * into v_existing from public.orders where request_id=p_request_id;
    if found then return jsonb_build_object('id',v_existing.id,'order_number',v_existing.order_number,'total',v_existing.total,'currency',v_existing.currency,'payment_method',v_existing.payment_method); end if;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Invalid cart.'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'A cart can contain up to 50 lines.'; end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_contact) is distinct from 'object' or jsonb_typeof(p_address) is distinct from 'object' then
    raise exception 'Contact and delivery details are required.';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(v_email)>254 then
    raise exception 'Enter a valid email address.';
  end if;
  if length(trim(coalesce(p_contact->>'first_name',''))) not between 1 and 100
    or length(trim(coalesce(p_contact->>'last_name',''))) not between 1 and 100
    or length(trim(coalesce(p_address->>'address_line1',''))) not between 1 and 250
    or length(trim(coalesce(p_address->>'city',''))) not between 1 and 100
    or length(trim(coalesce(p_address->>'country',''))) not between 1 and 100
    or length(coalesce(p_contact->>'phone',''))>40
    or length(coalesce(p_address->>'address_line2',''))>250
    or length(coalesce(p_address->>'province',''))>100
    or length(coalesce(p_address->>'postal_code',''))>30
    or length(coalesce(p_note,''))>2000 then raise exception 'Check your contact and delivery details.';
  end if;
  -- Serialize per email to enforce a bounded pending-order window. A trusted
  -- CAPTCHA/edge rate limit is still required against distributed fabricated emails.
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_email,0));
  if (select count(*) from public.orders where email=v_email and status='pending'
      and created_at > now()-interval '24 hours') >= 3 then
    raise exception 'You already have pending orders. Please contact us before placing another.';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(it->>'quantity','') !~ '^[0-9]{1,2}$' or (it->>'quantity')::int not between 1 and 10 then
      raise exception 'Choose between 1 and 10 of each rug.';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'product_id',coalesce(x->>'variant_id','') having count(*)>1) then
    raise exception 'Duplicate cart lines are not allowed.';
  end if;
  -- Consistent catalogue lock order prevents deadlocks across multi-rug carts.
  perform id from public.products where id in (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x) order by id for update;

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
  update public.orders set request_id=p_request_id,reservation_expires_at=now()+interval '48 hours' where id=v_order_id;

  -- ---- line items: lock rows, verify stock, price from the database ----
  for it in select * from jsonb_array_elements(p_items) order by value->>'product_id',value->>'variant_id' loop
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

    if var.id is null and exists(select 1 from public.product_variants where product_id=prod.id) then
      raise exception 'Please choose a size for this rug.';
    end if;

    available := case when var.id is not null then var.stock_quantity else prod.stock_quantity end;
    if qty > available then
      raise exception 'Only % left in stock for "%".', available, prod.name using errcode = 'P0001';
    end if;

    unit := prod.price + coalesce(var.price_delta, 0);
    if unit < 0 then raise exception 'This size has an invalid price. Please contact us.'; end if;
    v_subtotal := v_subtotal + (unit * qty);

    select url into v_image from public.product_images
      where product_id = prod.id order by sort_order, created_at limit 1;

    insert into public.order_items (order_id, product_id, variant_id, product_name,
                                    size_label, image_url, unit_price, quantity, line_total)
    values (v_order_id, prod.id, var.id, prod.name,
            coalesce(var.label,''), v_image, unit, qty, unit * qty);

    if var.id is not null then
      update public.product_variants set stock_quantity = stock_quantity - qty where id = var.id;
      update public.products set stock_quantity = (select coalesce(sum(stock_quantity),0) from public.product_variants where product_id=prod.id and is_active) where id=prod.id;
    else
      update public.products set stock_quantity = stock_quantity - qty where id = prod.id;
    end if;
  end loop;

  if v_subtotal = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;

  -- ---- promo ----
  if nullif(trim(coalesce(p_promo_code,'')),'') is not null then
    select * into v_promo_row from public.promo_codes where upper(code)=upper(trim(p_promo_code)) for update;
    v_promo := public.validate_promo(p_promo_code, v_subtotal);
    if coalesce((v_promo->>'valid')::boolean, false) then
      v_discount   := (v_promo->>'discount')::numeric;
      v_promo_code := v_promo->>'code';
      update public.promo_codes set used_count = used_count + 1
        where upper(code) = upper(v_promo_code);
    else
      raise exception '%', coalesce(v_promo->>'reason','That promotion is no longer available.');
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

revoke all on function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text,uuid) from public;
grant execute on function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text,uuid) to anon, authenticated;

-- Replace the old enumerable guest lookup. Existing authenticated owners retain access.
drop function public.track_order(text,text);
create function public.track_order(p_order_number text,p_email text,p_tracking_token text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where order_number=upper(trim(p_order_number)) and lower(email)=lower(trim(p_email))
    and (user_id=public.current_user_id() or public.is_admin() or id::text=p_tracking_token);
  if not found then return jsonb_build_object('found',false); end if;
  return jsonb_build_object('found',true,'order',jsonb_build_object(
    'order_number',o.order_number,'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,
    'currency',o.currency,'subtotal',o.subtotal,'discount_amount',o.discount_amount,'shipping_amount',o.shipping_amount,
    'promo_code',o.promo_code,'total',o.total,'created_at',o.created_at,'shipping_method',o.shipping_method,'city',o.city,'country',o.country),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'product_name',product_name,'size_label',size_label,'quantity',quantity,'unit_price',unit_price,'line_total',line_total,'image_url',image_url)) from public.order_items where order_id=o.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('label',label,'note','','created_at',created_at) order by created_at) from public.order_events where order_id=o.id),'[]'::jsonb));
end $$;
revoke all on function public.track_order(text,text,text) from public;
grant execute on function public.track_order(text,text,text) to anon,authenticated;

-- Additional RLS checks on lower-trust public submissions.

-- Save catalogue metadata, media and sizes as one transaction.
create or replace function public.admin_save_product(p_product jsonb,p_images jsonb,p_variants jsonb,p_product_id uuid default null,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid := p_product_id; v public.products%rowtype; it jsonb; v_stock int; i int;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if jsonb_typeof(p_images) is distinct from 'array' or jsonb_typeof(p_variants) is distinct from 'array'
    or jsonb_array_length(p_images)>30 or jsonb_array_length(p_variants)>50 then raise exception 'Invalid product media or sizes.'; end if;
  if length(trim(p_product->>'name')) not between 1 and 200 or length(trim(p_product->>'sku')) not between 1 and 100
    or coalesce(p_product->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Check the product name, SKU and URL.'; end if;
  if v_id is null then
    insert into public.products(name,sku,slug,price) values(p_product->>'name',p_product->>'sku',p_product->>'slug',(p_product->>'price')::numeric) returning id into v_id;
  end if;
  select * into v from public.products where id=v_id for update;
  if not found then raise exception 'Product not found.'; end if;
  if p_expected_updated_at is not null and v.updated_at <> p_expected_updated_at then
    raise exception 'This product changed while you were editing. Reload it before saving to preserve the latest stock.';
  end if;
  select * into v from jsonb_populate_record(v,p_product-'id'-'created_at'-'rating_avg'-'rating_count');
  if v.price<0 or v.price='NaN'::numeric or v.price>9999999999 or v.stock_quantity<0 or v.low_stock_at<0
    or (v.compare_at_price is not null and (v.compare_at_price<v.price or v.compare_at_price='NaN'::numeric)) then raise exception 'Invalid product price or stock.'; end if;
  -- Reject cross-product child IDs before any destructive change.
  if exists(select 1 from jsonb_array_elements(p_images) x where nullif(x->>'id','') is not null and not exists(select 1 from public.product_images where id=(x->>'id')::uuid and product_id=v_id))
    or exists(select 1 from jsonb_array_elements(p_variants) x where nullif(x->>'id','') is not null and not exists(select 1 from public.product_variants where id=(x->>'id')::uuid and product_id=v_id)) then raise exception 'Invalid product media or size identifier.'; end if;
  delete from public.product_images where product_id=v_id;
  i:=0;
  for it in select * from jsonb_array_elements(p_images) loop
    if coalesce(it->>'url','') !~ '^(https://|/assets/)' then raise exception 'Use a secure product media URL.'; end if;
    if i=0 and split_part(lower(it->>'url'),'?',1) ~ '[.](mp4|webm)$' then raise exception 'The cover must be a photo.'; end if;
    insert into public.product_images(id,product_id,url,alt,sort_order) values(coalesce(nullif(it->>'id','')::uuid,gen_random_uuid()),v_id,it->>'url',coalesce(it->>'alt',v.name),i);
    i:=i+1;
  end loop;
  delete from public.product_variants where product_id=v_id and id not in
    (select (x->>'id')::uuid from jsonb_array_elements(p_variants) x where nullif(x->>'id','') is not null);
  -- Temporary labels allow an administrator to swap two existing labels atomically.
  update public.product_variants set label=id::text where product_id=v_id;
  i:=0; v_stock:=0;
  for it in select * from jsonb_array_elements(p_variants) loop
    if length(trim(coalesce(it->>'label',''))) not between 1 and 100
      or coalesce(it->>'stock_quantity','') !~ '^[0-9]{1,7}$'
      or (it->>'price_delta')::numeric='NaN'::numeric
      or v.price+(it->>'price_delta')::numeric<0 then raise exception 'Check size labels, prices and whole-number stock.'; end if;
    insert into public.product_variants(id,product_id,label,price_delta,stock_quantity,sort_order,is_active)
      values(coalesce(nullif(it->>'id','')::uuid,gen_random_uuid()),v_id,trim(it->>'label'),(it->>'price_delta')::numeric,(it->>'stock_quantity')::int,i,coalesce((it->>'is_active')::boolean,true))
      on conflict(id) do update set label=excluded.label,price_delta=excluded.price_delta,stock_quantity=excluded.stock_quantity,sort_order=excluded.sort_order,is_active=excluded.is_active;
    if coalesce((it->>'is_active')::boolean,true) then v_stock:=v_stock+(it->>'stock_quantity')::int; end if;
    i:=i+1;
  end loop;
  if i>0 then v.stock_quantity:=v_stock; end if;
  update public.products set name=v.name,sku=v.sku,slug=v.slug,short_description=v.short_description,description=v.description,
    category_id=v.category_id,price=v.price,compare_at_price=v.compare_at_price,stock_quantity=v.stock_quantity,low_stock_at=v.low_stock_at,
    material=v.material,dimensions=v.dimensions,weave_technique=v.weave_technique,color=v.color,colors=v.colors,room=v.room,style=v.style,status=v.status,is_featured=v.is_featured where id=v_id;
  return v_id;
end $$;
revoke all on function public.admin_save_product(jsonb,jsonb,jsonb,uuid,timestamptz) from public,anon;
grant execute on function public.admin_save_product(jsonb,jsonb,jsonb,uuid,timestamptz) to authenticated;

-- Public submissions cannot impersonate an administrator reply or another order owner.
drop policy "reviews author insert" on public.reviews;
create policy "reviews author insert" on public.reviews for insert with check (
  user_id=public.current_user_id() and status='pending' and admin_reply='' and length(body)<=5000 and length(title)<=200
  and (order_id is null or exists(select 1 from public.orders where id=order_id and user_id=public.current_user_id()))
);
drop policy "contact insert any" on public.contact_messages;
create policy "contact insert any" on public.contact_messages for insert with check (
  not is_read and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' and length(email)<=254
  and length(first_name) between 1 and 100 and length(last_name)<=100 and length(phone)<=40 and length(topic)<=150 and length(message) between 1 and 5000
);
drop policy "newsletter insert any" on public.newsletter_subscribers;
create policy "newsletter insert any" on public.newsletter_subscribers for insert with check (
  email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' and length(email)<=254
);
-- Only newly placed offline orders receive a reservation expiry. Existing data is preserved.
create index if not exists orders_pending_email_created on public.orders(email,created_at) where status='pending';
create index if not exists orders_reservation_expiry on public.orders(reservation_expires_at) where status='pending';
create or replace function public.release_expired_reservations()
returns int language plpgsql security definer set search_path=public as $$
declare o record; r record; n int:=0;
begin
  for o in select id,promo_code from public.orders where status='pending' and payment_status in ('unpaid','awaiting_confirmation')
    and reservation_expires_at<=now() order by id for update skip locked loop
    -- Match checkout's product-before-variant lock order.
    perform id from public.products where id in(select product_id from public.order_items where order_id=o.id) order by id for update;
    for r in select product_id,sum(quantity)::int qty from public.order_items where order_id=o.id and product_id is not null group by product_id loop
      update public.products set stock_quantity=stock_quantity+r.qty where id=r.product_id;
    end loop;
    for r in select variant_id,sum(quantity)::int qty from public.order_items where order_id=o.id and variant_id is not null group by variant_id loop
      update public.product_variants set stock_quantity=stock_quantity+r.qty where id=r.variant_id;
    end loop;
    update public.products p set stock_quantity=(select coalesce(sum(v.stock_quantity),0) from public.product_variants v where v.product_id=p.id and v.is_active)
      where p.id in(select product_id from public.order_items where order_id=o.id)
        and exists(select 1 from public.product_variants v where v.product_id=p.id);
    if o.promo_code is not null then update public.promo_codes set used_count=greatest(used_count-1,0) where upper(code)=upper(o.promo_code); end if;
    update public.orders set status='cancelled',reservation_expires_at=null where id=o.id;
    insert into public.order_events(order_id,label,note) values(o.id,'Cancelled','Pending payment reservation expired. Please contact us to reorder.');
    n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function public.release_expired_reservations() from public,anon,authenticated;
-- Supabase supports pg_cron; enabling this scheduler is required for bounded holds.
create extension if not exists pg_cron;
select cron.schedule('rugistan-expire-reservations','*/15 * * * *','select public.release_expired_reservations()');

-- A store currency change would mix monetary units in existing analytics and catalogues.
create or replace function public.protect_base_currency()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.key='store' and coalesce(old.value->>'currency','USD') is distinct from coalesce(new.value->>'currency','USD')
    and (exists(select 1 from public.products) or exists(select 1 from public.orders)) then
    raise exception 'Base currency cannot change while products or orders exist. Use display currency conversion instead.';
  end if;
  return new;
end $$;
create trigger settings_protect_currency before update on public.settings for each row execute function public.protect_base_currency();

create or replace function public.admin_save_shipping(p_rows jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>50 then raise exception 'Invalid shipping methods.'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if length(trim(coalesce(r->>'name',''))) not between 1 and 100 or (r->>'amount')::numeric<0 or (r->>'amount')::numeric='NaN'::numeric then raise exception 'Check delivery names and charges.'; end if;
    insert into public.shipping_methods(id,name,description,amount,is_active,sort_order)
      values(coalesce(nullif(r->>'id','')::uuid,gen_random_uuid()),trim(r->>'name'),coalesce(r->>'description',''),(r->>'amount')::numeric,(r->>'is_active')::boolean,(r->>'sort_order')::int)
      on conflict(id) do update set name=excluded.name,description=excluded.description,amount=excluded.amount,is_active=excluded.is_active,sort_order=excluded.sort_order;
  end loop;
end $$;
revoke all on function public.admin_save_shipping(jsonb) from public,anon;
grant execute on function public.admin_save_shipping(jsonb) to authenticated;

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
        from (select user_id, count(*) as c from public.orders where user_id is not null and status <> 'cancelled' group by user_id) t), 0),
    'aov',            coalesce((select round(avg(total),2) from public.orders where status <> 'cancelled' and created_at >= p_from and created_at < p_to), 0),
    'by_status',      coalesce((select jsonb_object_agg(status, n) from
                        (select status::text, count(*) n from public.orders group by status) s), '{}'::jsonb)
  ) into res;
  return res;
end $$;

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

  perform id from public.products where id in(select product_id from public.order_items where order_id=p_order_id) order by id for update;

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
    update public.products p set stock_quantity=(select coalesce(sum(v.stock_quantity),0) from public.product_variants v where v.product_id=p.id and v.is_active)
      where p.id in(select product_id from public.order_items where order_id=p_order_id)
        and exists(select 1 from public.product_variants v where v.product_id=p.id);
  end if;

  update public.orders set status = p_status where id = p_order_id;
  insert into public.order_events (order_id, label, note)
  values (p_order_id,
          (case p_status when 'pending' then 'Order Placed' when 'processing' then 'Processing'
                         when 'shipped' then 'Shipped' when 'delivered' then 'Delivered'
                         else 'Cancelled' end),
          coalesce(p_note,''));
end $$;


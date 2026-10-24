-- Staff-only data must not share customer-readable order rows.
create table public.order_admin_notes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.order_admin_notes enable row level security;
revoke all on public.order_admin_notes from public, anon, authenticated;
grant select,insert,update,delete on public.order_admin_notes to authenticated;
create policy "team notes only" on public.order_admin_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
insert into public.order_admin_notes(order_id,body)
select id,admin_note from public.orders where admin_note<>'';
alter table public.orders drop column admin_note;

-- No public caller can bypass the trusted server's rate limiting.
revoke execute on function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.place_order(jsonb,jsonb,jsonb,uuid,text,text,text,uuid) to service_role;
revoke insert on public.contact_messages,public.newsletter_subscribers,public.product_views from public,anon,authenticated;
drop policy "contact insert any" on public.contact_messages;
drop policy "newsletter insert any" on public.newsletter_subscribers;
drop policy "published product view insert" on public.product_views;

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.api_rate_limits (
  bucket text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
alter table private.api_rate_limits enable row level security;
create index api_rate_limits_expiry on private.api_rate_limits(expires_at);
-- Separate transaction from the write: failed writes still consume quota.
-- Fixed global budgets also bound counter cardinality under distributed abuse.
create function public.consume_store_quota(p_action text,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_limit int; v_global int; v_seconds int; v_bucket text; v_global_bucket text;
  v_end timestamptz; v_day_end timestamptz; v_hits int; v_now timestamptz:=clock_timestamp();
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid quota key.'; end if;
  case p_action
    when 'checkout' then v_limit:=5; v_global:=1000; v_seconds:=900;
    when 'contact' then v_limit:=5; v_global:=1000; v_seconds:=3600;
    when 'newsletter' then v_limit:=5; v_global:=2000; v_seconds:=3600;
    when 'view' then v_limit:=120; v_global:=200000; v_seconds:=3600;
    else raise exception 'Invalid action.';
  end case;
  v_global_bucket:=p_action||':global:'||floor(extract(epoch from v_now)/86400)::text;
  v_day_end:=to_timestamp((floor(extract(epoch from v_now)/86400)+1)*86400);
  -- Serialize global admission, but charge it only after this client's quota admits the request.
  -- Denied retries from one client must never consume everybody else's daily allowance.
  perform pg_advisory_xact_lock(hashtextextended(v_global_bucket,0));
  select hits into v_hits from private.api_rate_limits where bucket=v_global_bucket;
  if coalesce(v_hits,0)>=v_global then
    return jsonb_build_object('allowed',false,'retry_after',greatest(1,ceil(extract(epoch from v_day_end-v_now))));
  end if;
  delete from private.api_rate_limits where bucket in
    (select bucket from private.api_rate_limits where expires_at<v_now order by expires_at limit 1000);
  v_bucket:=p_action||':'||p_key||':'||floor(extract(epoch from v_now)/v_seconds)::text;
  v_end:=to_timestamp((floor(extract(epoch from v_now)/v_seconds)+1)*v_seconds);
  v_hits:=null;
  insert into private.api_rate_limits(bucket,hits,expires_at) values(v_bucket,1,v_end)
    on conflict(bucket) do update set hits=private.api_rate_limits.hits+1
    where private.api_rate_limits.hits<v_limit returning hits into v_hits;
  if v_hits is null then return jsonb_build_object('allowed',false,'retry_after',greatest(1,ceil(extract(epoch from v_end-v_now)))); end if;
  insert into private.api_rate_limits(bucket,hits,expires_at) values(v_global_bucket,1,v_day_end)
    on conflict(bucket) do update set hits=private.api_rate_limits.hits+1;
  return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.consume_store_quota(text,text) from public,anon,authenticated;
grant execute on function public.consume_store_quota(text,text) to service_role;

-- Only the server may supply the cryptographically verified Clerk user id.
create function public.store_write(p_action text,p_payload jsonb,p_user_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(coalesce(p_payload->>'email',''))); v_product uuid;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>32768 then raise exception 'Invalid submission.'; end if;
  if p_action='checkout' then
    if p_user_id is not null and p_user_id !~ '^user_[a-zA-Z0-9]+$' then raise exception 'Invalid identity.'; end if;
    perform set_config('request.jwt.claims',case when p_user_id is null then '{}' else jsonb_build_object('sub',p_user_id,'role','authenticated')::text end,true);
    return public.place_order(p_payload->'p_items',p_payload->'p_contact',p_payload->'p_address',
      nullif(p_payload->>'p_shipping_method_id','')::uuid,coalesce(p_payload->>'p_payment_method',''),
      p_payload->>'p_promo_code',coalesce(p_payload->>'p_note',''),nullif(p_payload->>'p_request_id','')::uuid);
  elsif p_action in ('contact','newsletter') then
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or length(v_email)>254 then raise exception 'Enter a valid email address.'; end if;
    if p_action='newsletter' then
      insert into public.newsletter_subscribers(email) values(v_email) on conflict(email) do nothing;
    else
      if length(trim(coalesce(p_payload->>'first_name',''))) not between 1 and 100
        or length(coalesce(p_payload->>'last_name',''))>100 or length(coalesce(p_payload->>'phone',''))>40
        or length(coalesce(p_payload->>'topic',''))>150 or length(trim(coalesce(p_payload->>'message',''))) not between 10 and 5000 then
        raise exception 'Check your name and message (10–5000 characters).';
      end if;
      insert into public.contact_messages(first_name,last_name,email,phone,topic,message)
        values(trim(p_payload->>'first_name'),coalesce(p_payload->>'last_name',''),v_email,coalesce(p_payload->>'phone',''),coalesce(p_payload->>'topic',''),trim(p_payload->>'message'));
    end if;
  elsif p_action='view' then
    v_product:=(p_payload->>'product_id')::uuid;
    if not exists(select 1 from public.products where id=v_product and status='published') then raise exception 'Product unavailable.'; end if;
    insert into public.product_views(product_id,session_key) values(v_product,(p_payload->>'session_key')::uuid) on conflict do nothing;
  else raise exception 'Invalid action.';
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.store_write(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.store_write(text,jsonb,text) to service_role;

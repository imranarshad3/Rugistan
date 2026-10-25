begin;
create table public.team_access (
 role text not null check(role in('super_admin','admin')),
 user_id text primary key references public.profiles(id) on delete cascade,
 permissions text[] not null default '{}' check(permissions <@ array['products','categories','orders','customers','content','reviews','analytics','settings']::text[]),
 check(permissions=case when role='super_admin' then array['products','categories','orders','customers','content','reviews','analytics','settings']::text[] else array['products','categories','orders','customers','content','reviews','analytics']::text[] end),
 granted_by text references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.team_access enable row level security;
revoke all on public.team_access from public,anon,authenticated;
grant select on public.team_access to authenticated;
create policy "own team access or administrator" on public.team_access for select to authenticated
 using(user_id=public.current_user_id() or public.is_admin());
create table public.team_invitations (
 id uuid primary key default gen_random_uuid(),email text not null check(length(email)<=254 and email=lower(trim(email))),
 permissions text[] not null default '{}' check(permissions <@ array['products','categories','orders','customers','content','reviews','analytics','settings']::text[]),
 role text not null check(role in('owner','super_admin','admin')),
 is_admin boolean not null default false,
 invited_by text not null references public.profiles(id),
 status text not null default 'sending' check(status in('sending','pending','accepted','revoked','failed')),
 clerk_invitation_id text,accepted_by text references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz,
 check(is_admin=(role='owner')),
 check(permissions=case when role='owner' then '{}'::text[] when role='super_admin' then array['products','categories','orders','customers','content','reviews','analytics','settings']::text[] else array['products','categories','orders','customers','content','reviews','analytics']::text[] end)
);
create index team_invitation_email on public.team_invitations(email,status);
alter table public.team_invitations enable row level security;
revoke all on public.team_invitations from public,anon,authenticated;
grant select on public.team_invitations to authenticated;
create policy "administrator invitations only" on public.team_invitations for select to authenticated using(public.is_admin());
grant all on public.team_access,public.team_invitations to service_role;
create function public.has_team_permission(p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_permission=any(array['products','categories','orders','customers','content','reviews','analytics','settings'])
 and (public.is_admin() or exists(select 1 from public.team_access a where a.user_id=public.current_user_id() and p_permission=any(a.permissions)))
$$;
revoke all on function public.has_team_permission(text) from public;
grant execute on function public.has_team_permission(text) to anon,authenticated;
-- Retain existing public/owner conditions and policy roles; change only the staff branch.
do $$ declare p record; permission text; q text; w text;
begin
 for p in select * from pg_policies where schemaname='public' and tablename in
 ('products','product_images','product_variants','categories','orders','order_items','order_events','order_admin_notes','banners','pages','reviews','settings','shipping_methods','promo_codes') loop
  permission:=case when p.tablename in('products','product_images','product_variants') then 'products'
   when p.tablename='categories' then 'categories'
   when p.tablename in('orders','order_items','order_events','order_admin_notes') then 'orders'
   when p.tablename in('banners','pages') then 'content' when p.tablename='reviews' then 'reviews' else 'settings' end;
  q:=replace(replace(p.qual,'public.is_admin()',format('public.has_team_permission(%L)',permission)),'is_admin()',format('public.has_team_permission(%L)',permission));
  w:=replace(replace(p.with_check,'public.is_admin()',format('public.has_team_permission(%L)',permission)),'is_admin()',format('public.has_team_permission(%L)',permission));
  if q is distinct from p.qual or w is distinct from p.with_check then
   execute format('alter policy %I on public.%I%s%s',p.policyname,p.tablename,
    case when q is not null then ' using ('||q||')' else '' end,
    case when w is not null then ' with check ('||w||')' else '' end);
  end if;
 end loop;
end $$;
create policy "customer directory for assigned team" on public.profiles for select to authenticated
 using(role='customer' and public.has_team_permission('customers'));
-- RPCs must enforce the same module permission as direct RLS access.
do $$ declare f record; permission text; definition text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in('admin_save_product','admin_product_views','admin_save_shipping','admin_dashboard_stats','admin_sales_series','admin_top_products','admin_top_categories','admin_customers','admin_set_order_status','track_order') loop
  permission:=case when f.proname in('admin_save_product','admin_product_views') then 'products'
   when f.proname='admin_save_shipping' then 'settings' when f.proname='admin_customers' then 'customers'
   when f.proname in('admin_set_order_status','track_order') then 'orders' else 'analytics' end;
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(replace(definition,'public.is_admin()',format('public.has_team_permission(%L)',permission)),'is_admin()',format('public.has_team_permission(%L)',permission));
  execute definition;
 end loop;
end $$;
create function public.can_write_team_media(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.is_admin() or case split_part(p_name,'/',1)
 when 'products' then public.has_team_permission('products') when 'categories' then public.has_team_permission('categories')
 when 'banners' then public.has_team_permission('content') when 'pages' then public.has_team_permission('content')
 when 'brand' then public.has_team_permission('settings')
 when 'avatars' then split_part(p_name,'/',2)=public.current_user_id() and exists(select 1 from public.team_access where user_id=public.current_user_id() and cardinality(permissions)>0)
 else false end
$$;
revoke all on function public.can_write_team_media(text) from public;
grant execute on function public.can_write_team_media(text) to authenticated;
create policy "assigned team media insert" on storage.objects for insert to authenticated with check(bucket_id='media' and public.can_write_team_media(name));
create policy "assigned team media update" on storage.objects for update to authenticated using(bucket_id='media' and public.can_write_team_media(name)) with check(bucket_id='media' and public.can_write_team_media(name));
create policy "assigned team media delete" on storage.objects for delete to authenticated using(bucket_id='media' and public.can_write_team_media(name));
-- Fixed roles are authoritative. Only the verified server gateway can grant them.
create function public.effective_team_role(p_user text) returns text
language sql stable security definer set search_path='' as $$
 select case when p.role='admin' then 'owner' else a.role end from public.profiles p left join public.team_access a on a.user_id=p.id where p.id=p_user
$$;
revoke all on function public.effective_team_role(text) from public,anon,authenticated;
grant execute on function public.effective_team_role(text) to service_role;
create function public.team_prepare_invitation(p_actor text,p_email text,p_permissions text[],p_is_admin boolean,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.team_invitations%rowtype; actor_role text;
begin
 perform pg_advisory_xact_lock(hashtextextended('team-administrators',0));
 actor_role:=public.effective_team_role(p_actor);
 if not(coalesce(actor_role='owner' or (actor_role='super_admin' and p_role='admin'),false)) then raise exception 'This role cannot be assigned.' using errcode='42501'; end if;
 if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('team-invite:'||lower(trim(p_email)),0));
 if actor_role<>'owner' and exists(select 1 from public.team_invitations where email=lower(trim(p_email)) and status in('sending','pending') and role<>'admin') then raise exception 'This invitation belongs to a higher role.'; end if;
 update public.team_invitations set status='revoked' where email=lower(trim(p_email)) and status in('sending','pending');
 insert into public.team_invitations(email,permissions,is_admin,role,invited_by) values(lower(trim(p_email)),p_permissions,p_is_admin,p_role,p_actor) returning * into invitation;
 return to_jsonb(invitation);
end $$;
create function public.team_accept_invitation(p_invitation uuid,p_user text,p_verified_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.team_invitations%rowtype; existing_role text; actor_role text;
begin
 perform pg_advisory_xact_lock(hashtextextended('team-administrators',0));
 select * into invitation from public.team_invitations where id=p_invitation for update;
 if not found or invitation.email<>lower(trim(p_verified_email)) or invitation.expires_at<=now() then raise exception 'This invitation is unavailable or belongs to a different email.'; end if;
 if invitation.status='accepted' and invitation.accepted_by=p_user then return jsonb_build_object('accepted',true); end if;
 if invitation.status<>'pending' then raise exception 'This invitation is no longer active.'; end if;
 actor_role:=public.effective_team_role(invitation.invited_by);
 if not(coalesce(actor_role='owner' or (actor_role='super_admin' and invitation.role='admin'),false)) then raise exception 'This invitation is no longer authorised.'; end if;
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise exception 'Create your store profile before accepting.'; end if;
 existing_role:=public.effective_team_role(p_user);
 -- Accepting a lower-role email never demotes an existing team member.
 if invitation.role='owner' then
  update public.profiles set role='admin' where id=p_user;
  delete from public.team_access where user_id=p_user;
 elsif coalesce(existing_role,'')<>'owner' and not(coalesce(existing_role,'')='super_admin' and invitation.role='admin') then
  insert into public.team_access(user_id,role,permissions,granted_by) values(p_user,invitation.role,invitation.permissions,invitation.invited_by)
   on conflict(user_id) do update set role=excluded.role,permissions=excluded.permissions,granted_by=excluded.granted_by,updated_at=now();
 end if;
 update public.team_invitations set status='accepted',accepted_by=p_user,accepted_at=now() where id=p_invitation;
 return jsonb_build_object('accepted',true);
end $$;
create function public.team_set_access(p_actor text,p_user text,p_permissions text[],p_is_admin boolean,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare actor_role text; target_role text;
begin
 perform pg_advisory_xact_lock(hashtextextended('team-administrators',0));
 actor_role:=public.effective_team_role(p_actor); target_role:=public.effective_team_role(p_user);
 if p_actor=p_user then raise exception 'You cannot change your own role.'; end if;
 if target_role='owner' then raise exception 'Owner accounts are protected.'; end if;
 if not(coalesce(actor_role='owner' or (actor_role='super_admin' and target_role='admin' and (p_role='admin' or p_role is null)),false)) then raise exception 'You cannot manage this role.' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_user) then raise exception 'Team member not found.'; end if;
 if p_is_admin is distinct from (coalesce(p_role,'')='owner') then raise exception 'Invalid role.'; end if;
 if p_role is null and cardinality(p_permissions)<>0 then raise exception 'Invalid role.'; end if;
 update public.profiles set role=case when p_role='owner' then 'admin'::public.user_role else 'customer'::public.user_role end where id=p_user;
 if p_role is null or p_role='owner' then delete from public.team_access where user_id=p_user;
 else insert into public.team_access(user_id,role,permissions,granted_by) values(p_user,p_role,p_permissions,p_actor)
  on conflict(user_id) do update set role=excluded.role,permissions=excluded.permissions,granted_by=excluded.granted_by,updated_at=now(); end if;
end $$;
revoke all on function public.team_prepare_invitation(text,text,text[],boolean,text),public.team_accept_invitation(uuid,text,text),public.team_set_access(text,text,text[],boolean,text) from public,anon,authenticated;
grant execute on function public.team_prepare_invitation(text,text,text[],boolean,text),public.team_accept_invitation(uuid,text,text),public.team_set_access(text,text,text[],boolean,text) to service_role;
commit;

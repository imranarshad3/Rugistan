-- Internal trigger helpers are not public RPC endpoints.
alter function public.set_updated_at() set search_path = public;
alter function public.slugify(text) set search_path = public, extensions;
revoke all on function public.refresh_product_rating() from public, anon, authenticated;

-- Keep explicit signed-in access and the existing is_admin checks inside each RPC.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,6)='admin_'
  loop
    execute format('revoke all on function %s from public, anon',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
notify pgrst, 'reload schema';

begin;
-- Supabase default privileges may grant anon EXECUTE directly, independently of PUBLIC.
revoke all on function public.can_write_team_media(text) from anon;
commit;

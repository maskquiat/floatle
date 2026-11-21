-- Floatle: block student email addresses from creating accounts.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Then turn it on: Authentication -> Hooks -> "Before User Created"
--   -> Postgres function -> public.hook_block_student_signups -> Save.
-- To block another domain later, add it to the list below.

create or replace function public.hook_block_student_signups(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  user_email text := lower(coalesce(event->'user'->>'email', ''));
  blocked_domains text[] := array['live.wpcsd.k12.ny.us'];
begin
  if split_part(user_email, '@', 2) = any(blocked_domains) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Floatle accounts are for teachers and staff. Students don''t need an account.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

-- Only Supabase Auth may run this function.
grant execute on function public.hook_block_student_signups(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_block_student_signups(jsonb) from authenticated, anon, public;

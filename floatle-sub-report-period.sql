-- Floatle: add "Period you covered" to sub reports
-- Run in Supabase: SQL Editor -> New query.
--
-- The site already works without this: until it's run, the period a sub types is sent
-- as the first line of "Anything else" ("Period: 3"), and the Sub reports inbox shows it
-- as the period. After it's run, the period gets its own column.

-- 1. A column for the period.
alter table public.sub_reports add column if not exists period text;

-- 2. Let submit_sub_report() accept it.
--    The function's body lives only in Supabase (Database -> Functions -> submit_sub_report),
--    so it can't be rewritten blindly here. Open its definition and make two small edits:
--
--    a) Add one parameter at the END of the parameter list:
--         , p_period text default ''
--
--    b) In its INSERT INTO sub_reports (...) VALUES (...), add the column and value:
--         ..., other_notes, period)
--         ..., p_other_notes, nullif(left(trim(p_period), 40), ''))
--
--    Adding a parameter changes the function's signature, so drop the old version first
--    (otherwise both versions exist and the site can't tell which to call):
--
--         drop function public.submit_sub_report(text, text, text, text, text, text[], text, text, text, text, text);
--         create function public.submit_sub_report( ...old parameters..., p_period text default '' ) ...
--
--    Check the old parameter types in the function's definition; the list above assumes
--    every parameter is text except p_interruptions (text[]).
--    Then re-grant it to anonymous visitors (subs aren't signed in):
--
--         grant execute on function public.submit_sub_report(text, text, text, text, text, text[], text, text, text, text, text, text) to anon, authenticated;
--
-- 3. Refresh the API so it sees the new parameter:
notify pgrst, 'reload schema';

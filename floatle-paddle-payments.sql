-- Floatle: payments with Paddle.
-- Run once in Supabase: SQL Editor -> New query -> paste all of this -> Run.
-- Safe to run more than once.

-- 1. Extra columns on the plans table, filled in by the paddle-webhook function.
alter table public.plans add column if not exists plan text;                    -- monthly, yearly or founding
alter table public.plans add column if not exists status text;                  -- Paddle's subscription status
alter table public.plans add column if not exists paid_until timestamptz;       -- end of the paid period
alter table public.plans add column if not exists pilot_until timestamptz;      -- district pilot end date, kept separately
alter table public.plans add column if not exists paddle_customer_id text;
alter table public.plans add column if not exists paddle_subscription_id text;
alter table public.plans add column if not exists last_event_at timestamptz;    -- ignore Paddle messages that arrive out of order

-- Keep each pilot teacher's pilot end date, so a paid plan never shortens it.
update public.plans set pilot_until = pro_until
where source = 'pilot' and pilot_until is null;

-- One plan row per teacher (the webhook updates it in place).
create unique index if not exists plans_user_id_unique on public.plans (user_id);

-- 2. Teachers can read their own plan but can never change it from the browser.
--    Only the webhook (which uses the service role) writes to this table.
revoke insert, update, delete on public.plans from anon, authenticated;

-- 3. How many Founding Teacher spots are left (of 100). Anyone can ask; it returns only a number.
create or replace function public.founding_spots_left()
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(0, 100 - count(*)::int)
  from public.plans
  where plan = 'founding' and status in ('active', 'trialing', 'past_due');
$$;
grant execute on function public.founding_spots_left() to anon, authenticated;

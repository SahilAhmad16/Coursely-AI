-- Final seller pricing: all plans have a one-time free 28-day trial.
-- Renewals are Service ₹50, Digital ₹60, and Physical ₹50.
alter table public.platform_subscriptions
  drop constraint if exists platform_subscriptions_amount_matches_plan;

update public.platform_subscriptions
set amount_paise = 5000
where plan_type = 'service';

alter table public.platform_subscriptions
  add constraint platform_subscriptions_amount_matches_plan check (
    (plan_type = 'service' and amount_paise = 5000)
    or (plan_type = 'digital' and amount_paise = 6000)
    or (plan_type = 'physical' and amount_paise = 5000)
  );

create or replace function public.ensure_service_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_plan public.seller_plan_type;
  target_amount integer;
begin
  if tg_op = 'UPDATE' and new.listing_type = old.listing_type then
    return new;
  end if;

  target_plan := case
    when new.listing_type = 'service' then 'service'::public.seller_plan_type
    when new.listing_type = 'digital' then 'digital'::public.seller_plan_type
    else 'physical'::public.seller_plan_type
  end;
  target_amount := case target_plan
    when 'digital' then 6000
    else 5000
  end;

  insert into public.platform_subscriptions (store_id, plan_type, amount_paise, status, is_trial, current_period_start, current_period_end)
  values (new.store_id, target_plan, target_amount, 'active', true, now(), now() + interval '28 days')
  on conflict (store_id, plan_type) do nothing;
  return new;
end;
$$;

-- Services have no per-sale commission. Digital and Physical product lines use 10%.
alter table public.platform_ledger
  drop constraint if exists platform_ledger_commission_rate_bps_check;
alter table public.platform_ledger
  add constraint platform_ledger_commission_rate_bps_check check (commission_rate_bps in (0, 1000));

create or replace function public.create_platform_ledger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status is distinct from 'paid' and new.status = 'paid' then
    insert into public.platform_ledger (order_id, seller_id, gross_paise, commission_rate_bps, commission_paise, seller_net_paise, status)
    select
      new.id,
      oi.seller_id,
      sum(oi.unit_price_paise * oi.quantity)::integer,
      case when sum(case when p.listing_type in ('digital', 'physical') then oi.unit_price_paise * oi.quantity else 0 end) > 0 then 1000 else 0 end,
      ceil(sum(case when p.listing_type in ('digital', 'physical') then oi.unit_price_paise * oi.quantity else 0 end) * 0.10)::integer,
      sum(oi.unit_price_paise * oi.quantity)::integer - ceil(sum(case when p.listing_type in ('digital', 'physical') then oi.unit_price_paise * oi.quantity else 0 end) * 0.10)::integer,
      'earned'
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = new.id
    group by oi.seller_id
    on conflict (order_id, seller_id) do nothing;
  end if;
  return new;
end;
$$;

with repriced as (
  select
    pl.id,
    coalesce(sum(case when p.listing_type in ('digital', 'physical') then oi.unit_price_paise * oi.quantity else 0 end), 0)::integer as commissionable_gross
  from public.platform_ledger pl
  join public.order_items oi on oi.order_id = pl.order_id and oi.seller_id = pl.seller_id
  join public.products p on p.id = oi.product_id
  group by pl.id
)
update public.platform_ledger pl
set
  commission_rate_bps = case when repriced.commissionable_gross > 0 then 1000 else 0 end,
  commission_paise = ceil(repriced.commissionable_gross * 0.10)::integer,
  seller_net_paise = pl.gross_paise - ceil(repriced.commissionable_gross * 0.10)::integer
from repriced
where pl.id = repriced.id;

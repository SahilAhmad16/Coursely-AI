-- Every seller category receives one free 28-day trial period.
update public.platform_subscriptions
set status = 'active',
    is_trial = true,
    current_period_start = coalesce(current_period_start, now()),
    current_period_end = coalesce(current_period_start, now()) + interval '28 days'
where status = 'pending'
  and current_period_end is null;

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
    when 'service' then 15000
    when 'digital' then 6000
    else 5000
  end;

  insert into public.platform_subscriptions (store_id, plan_type, amount_paise, status, is_trial, current_period_start, current_period_end)
  values (new.store_id, target_plan, target_amount, 'active', true, now(), now() + interval '28 days')
  on conflict (store_id, plan_type) do nothing;
  return new;
end;
$$;

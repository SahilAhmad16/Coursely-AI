-- Each seller category has its own 28-day plan. Service sellers receive one free first period.
do $$
begin
  create type public.seller_plan_type as enum ('service', 'digital', 'physical');
exception
  when duplicate_object then null;
end;
$$;

alter table public.platform_subscriptions
  add column if not exists plan_type public.seller_plan_type not null default 'service',
  add column if not exists is_trial boolean not null default false;

alter table public.platform_subscriptions
  drop constraint if exists platform_subscriptions_store_id_key;
alter table public.platform_subscriptions
  drop constraint if exists platform_subscriptions_amount_paise_check;
alter table public.platform_subscriptions
  add constraint platform_subscriptions_store_plan_unique unique (store_id, plan_type),
  add constraint platform_subscriptions_amount_matches_plan check (
    (plan_type = 'service' and amount_paise = 15000)
    or (plan_type = 'digital' and amount_paise = 6000)
    or (plan_type = 'physical' and amount_paise = 5000)
  );

-- Old pending service entries represent a seller's unused first free period.
update public.platform_subscriptions
set status = 'active',
    is_trial = true,
    current_period_start = coalesce(current_period_start, now()),
    current_period_end = coalesce(current_period_start, now()) + interval '28 days'
where plan_type = 'service'
  and status = 'pending'
  and current_period_end is null;

create or replace function private.listing_subscription_is_active(target_store_id uuid, target_listing_type public.listing_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_subscriptions ps
    where ps.store_id = target_store_id
      and ps.plan_type = case
        when target_listing_type = 'service' then 'service'::public.seller_plan_type
        when target_listing_type = 'digital' then 'digital'::public.seller_plan_type
        else 'physical'::public.seller_plan_type
      end
      and ps.status = 'active'
      and ps.current_period_end > now()
  );
$$;
revoke all on function private.listing_subscription_is_active(uuid, public.listing_type) from public;
grant execute on function private.listing_subscription_is_active(uuid, public.listing_type) to anon, authenticated;

create or replace function private.seller_listing_is_unlocked(target_store_id uuid, target_listing_type public.listing_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or not exists (
      select 1
      from public.platform_subscriptions ps
      where ps.store_id = target_store_id
        and ps.plan_type = case
          when target_listing_type = 'service' then 'service'::public.seller_plan_type
          when target_listing_type = 'digital' then 'digital'::public.seller_plan_type
          else 'physical'::public.seller_plan_type
        end
        and not (ps.status = 'active' and ps.current_period_end > now())
    );
$$;
revoke all on function private.seller_listing_is_unlocked(uuid, public.listing_type) from public;
grant execute on function private.seller_listing_is_unlocked(uuid, public.listing_type) to authenticated;

drop policy if exists "published active products public" on public.products;
create policy "published active products public" on public.products for select
using (
  (
    status = 'published'
    and private.listing_subscription_is_active(store_id, listing_type)
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "owners create unlocked products" on public.products;
create policy "owners create unlocked products" on public.products for insert to authenticated
with check (
  private.seller_listing_is_unlocked(store_id, listing_type)
  and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);

drop policy if exists "owners update unlocked products" on public.products;
create policy "owners update unlocked products" on public.products for update to authenticated
using (
  private.seller_listing_is_unlocked(store_id, listing_type)
  and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
)
with check (
  private.seller_listing_is_unlocked(store_id, listing_type)
  and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);

drop policy if exists "owners add unlocked product media" on public.product_media;
create policy "owners add unlocked product media" on public.product_media for insert to authenticated
with check (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_listing_is_unlocked(p.store_id, p.listing_type)
));

drop policy if exists "owners update unlocked product media" on public.product_media;
create policy "owners update unlocked product media" on public.product_media for update to authenticated
using (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_listing_is_unlocked(p.store_id, p.listing_type)
))
with check (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_listing_is_unlocked(p.store_id, p.listing_type)
));

drop policy if exists "owners delete unlocked product media" on public.product_media;
create policy "owners delete unlocked product media" on public.product_media for delete to authenticated
using (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_listing_is_unlocked(p.store_id, p.listing_type)
));

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

  if target_plan = 'service' then
    insert into public.platform_subscriptions (store_id, plan_type, amount_paise, status, is_trial, current_period_start, current_period_end)
    values (new.store_id, target_plan, target_amount, 'active', true, now(), now() + interval '28 days')
    on conflict (store_id, plan_type) do nothing;
  else
    insert into public.platform_subscriptions (store_id, plan_type, amount_paise)
    values (new.store_id, target_plan, target_amount)
    on conflict (store_id, plan_type) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists products_create_service_subscription on public.products;
create trigger products_create_service_subscription
after insert or update of listing_type on public.products
for each row execute procedure public.ensure_service_subscription();

create or replace function public.enforce_product_status_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('pending_review', 'published')
    and not private.listing_subscription_is_active(new.store_id, new.listing_type) then
    raise exception 'An active 28-day seller plan is required before this listing can be reviewed or published.';
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    return new;
  end if;
  if old.status not in ('draft', 'pending_review', 'rejected') or new.status not in ('draft', 'pending_review') then
    raise exception 'Only Coursely AI administrators can publish, reject, archive, or modify a published listing.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.products p join public.stores s on s.id = p.store_id
    where p.id = new.product_id
      and p.listing_type = 'service'
      and p.status = 'published'
      and private.listing_subscription_is_active(p.store_id, p.listing_type)
      and s.owner_id = new.seller_id
  ) then
    raise exception 'This service seller is not currently active.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_service_message_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_store_id uuid;
begin
  select p.store_id into target_store_id
  from public.conversations c join public.products p on p.id = c.product_id
  where c.id = new.conversation_id and p.listing_type = 'service';
  if target_store_id is not null and not private.listing_subscription_is_active(target_store_id, 'service'::public.listing_type) then
    raise exception 'This service seller account is locked until its 28-day subscription is renewed.';
  end if;
  return new;
end;
$$;

drop function if exists private.service_subscription_is_active(uuid);
drop function if exists private.seller_store_is_unlocked(uuid);

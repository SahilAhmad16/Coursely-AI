-- Keep RLS helpers out of the exposed public API schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.service_subscription_is_active(target_store_id uuid)
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
      and ps.status = 'active'
      and ps.current_period_end > now()
  );
$$;
revoke all on function private.service_subscription_is_active(uuid) from public;
grant execute on function private.service_subscription_is_active(uuid) to anon, authenticated;

create or replace function private.seller_store_is_unlocked(target_store_id uuid)
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
        and not (ps.status = 'active' and ps.current_period_end > now())
    );
$$;
revoke all on function private.seller_store_is_unlocked(uuid) from public;
grant execute on function private.seller_store_is_unlocked(uuid) to authenticated;

drop policy if exists "published active products public" on public.products;
create policy "published active products public" on public.products for select
using (
  (
    status = 'published'
    and (listing_type <> 'service' or private.service_subscription_is_active(store_id))
  )
  or exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = (select auth.uid())
  )
);

drop policy if exists "owners create unlocked products" on public.products;
create policy "owners create unlocked products" on public.products for insert to authenticated
with check (
  private.seller_store_is_unlocked(store_id)
  and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);

drop policy if exists "owners update unlocked products" on public.products;
create policy "owners update unlocked products" on public.products for update to authenticated
using (
  private.seller_store_is_unlocked(store_id)
  and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
)
with check (
  private.seller_store_is_unlocked(store_id)
  and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))
);

drop policy if exists "owners add unlocked product media" on public.product_media;
create policy "owners add unlocked product media" on public.product_media for insert to authenticated
with check (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_store_is_unlocked(p.store_id)
));

drop policy if exists "owners update unlocked product media" on public.product_media;
create policy "owners update unlocked product media" on public.product_media for update to authenticated
using (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_store_is_unlocked(p.store_id)
))
with check (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_store_is_unlocked(p.store_id)
));

drop policy if exists "owners delete unlocked product media" on public.product_media;
create policy "owners delete unlocked product media" on public.product_media for delete to authenticated
using (exists (
  select 1 from public.products p join public.stores s on s.id = p.store_id
  where p.id = product_id and s.owner_id = (select auth.uid()) and private.seller_store_is_unlocked(p.store_id)
));

create or replace function public.validate_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.products p join public.stores s on s.id = p.store_id
    where p.id = new.product_id
      and p.listing_type = 'service'
      and p.status = 'published'
      and private.service_subscription_is_active(p.store_id)
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
  if target_store_id is not null and not private.service_subscription_is_active(target_store_id) then
    raise exception 'This service seller account is locked until its 28-day subscription is renewed.';
  end if;
  return new;
end;
$$;

drop function public.service_subscription_is_active(uuid);
drop function public.seller_store_is_unlocked(uuid);

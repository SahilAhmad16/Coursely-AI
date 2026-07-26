-- A store becomes a seller account when it is created. Administrators remain
-- administrators, while regular buyers are promoted to the seller role.
create or replace function public.mark_store_owner_as_seller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = 'seller'
  where id = new.owner_id and role = 'buyer';
  return new;
end;
$$;
revoke all on function public.mark_store_owner_as_seller() from public;

create trigger stores_mark_owner_as_seller
  after insert on public.stores
  for each row execute procedure public.mark_store_owner_as_seller();

update public.profiles p
set role = 'seller'
where p.role = 'buyer'
  and exists (select 1 from public.stores s where s.owner_id = p.id);

-- Drafts are allowed before verification, but a listing cannot enter review or
-- become public until the store has been verified by an administrator.
create or replace function public.enforce_product_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('pending_review', 'published')
    and not private.listing_subscription_is_active(new.store_id, new.listing_type) then
    raise exception 'An active 28-day seller plan is required before this listing can be reviewed or published.';
  end if;

  if new.status in ('pending_review', 'published')
    and not exists (
      select 1 from public.stores s
      where s.id = new.store_id and s.is_verified
    ) then
    raise exception 'Your seller verification must be approved before a listing can be reviewed or published.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    return new;
  end if;

  if old.status not in ('draft', 'pending_review', 'rejected')
    or new.status not in ('draft', 'pending_review') then
    raise exception 'Only Coursely AI administrators can publish, reject, archive, or modify a published listing.';
  end if;
  return new;
end;
$$;

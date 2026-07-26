-- RLS can control rows but cannot compare an old and new status reliably.
-- This trigger prevents sellers from publishing listings through a direct API request.
create function public.enforce_product_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
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
revoke all on function public.enforce_product_status_transition() from public;
create trigger products_status_guard before update on public.products
for each row execute procedure public.enforce_product_status_transition();

-- Allow the administrator to update store verification without weakening the
-- existing owner rule. The trigger from the KYC migration still blocks owners
-- from changing is_verified themselves.
drop policy "owners update own store" on public.stores;
create policy "owners and admins update stores" on public.stores
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

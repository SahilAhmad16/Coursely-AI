-- Cover the administrator foreign key used by the review queue and keep the
-- verification policies compact without changing access rights.
create index seller_verifications_reviewed_by_idx
  on public.seller_verifications(reviewed_by);

drop policy "sellers view own verification" on public.seller_verifications;
drop policy "admins view seller verifications" on public.seller_verifications;
create policy "sellers and admins view verifications" on public.seller_verifications
  for select to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop policy "sellers resubmit own verification" on public.seller_verifications;
drop policy "admins review seller verifications" on public.seller_verifications;
create policy "sellers and admins update verifications" on public.seller_verifications
  for update to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

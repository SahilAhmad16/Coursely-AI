-- Keep personally identifying account data private. Public marketplace pages use store data, not profiles.
drop policy if exists "public profiles visible" on public.profiles;
create policy "users read own profile" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy "admins read profiles" on public.profiles
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'admin'
));

-- Published listings must be withdrawn through the controlled status workflow, not silently deleted.
drop policy if exists "owners delete products" on public.products;
create policy "owners delete unpublished products" on public.products
for delete to authenticated
using (
  status in ('draft', 'rejected')
  and exists (
    select 1 from public.stores s
    where s.id = store_id and s.owner_id = (select auth.uid())
  )
);

create policy "admins delete products" on public.products
for delete to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'admin'
));

-- Covers messages_sender_id_fkey and the sender-side inbox/admin queries.
create index if not exists messages_sender_created_idx on public.messages(sender_id, created_at desc);

-- Never let a normal user promote their own profile to administrator.
revoke update on public.profiles from authenticated;
grant update (full_name, username, avatar_path, phone) on public.profiles to authenticated;

-- Administrators review seller listings and oversee marketplace fulfilment.
create policy "admins view all products" on public.products for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "admins update all products" on public.products for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "admins view all orders" on public.orders for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "admins view all order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "admins view all shipments" on public.shipments for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

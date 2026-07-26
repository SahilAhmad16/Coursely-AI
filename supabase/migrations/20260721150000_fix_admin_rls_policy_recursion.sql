-- Keep admin checks out of RLS policy queries. Reading public.profiles from a
-- policy on public.profiles causes PostgreSQL to recursively re-evaluate that
-- same policy, which makes unrelated marketplace queries fail with HTTP 500.
create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'::public.account_role
  );
$$;

revoke all on function private.current_user_is_admin() from public;
grant execute on function private.current_user_is_admin() to authenticated;

drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins view audit logs" on public.audit_logs;
create policy "admins view audit logs" on public.audit_logs for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins resolve listing reports" on public.listing_reports;
create policy "admins resolve listing reports" on public.listing_reports for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "admins view listing reports" on public.listing_reports;
create policy "admins view listing reports" on public.listing_reports for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins create notifications" on public.notifications;
create policy "admins create notifications" on public.notifications for insert to authenticated
with check (private.current_user_is_admin());

drop policy if exists "admins view all order items" on public.order_items;
create policy "admins view all order items" on public.order_items for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins view all orders" on public.orders;
create policy "admins view all orders" on public.orders for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins view ledger" on public.platform_ledger;
create policy "admins view ledger" on public.platform_ledger for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins view subscriptions" on public.platform_subscriptions;
create policy "admins view subscriptions" on public.platform_subscriptions for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins delete products" on public.products;
create policy "admins delete products" on public.products for delete to authenticated
using (private.current_user_is_admin());

drop policy if exists "admins update all products" on public.products;
create policy "admins update all products" on public.products for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "admins view all products" on public.products;
create policy "admins view all products" on public.products for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "sellers and admins update verifications" on public.seller_verifications;
create policy "sellers and admins update verifications" on public.seller_verifications for update to authenticated
using (seller_id = (select auth.uid()) or private.current_user_is_admin())
with check (seller_id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists "sellers and admins view verifications" on public.seller_verifications;
create policy "sellers and admins view verifications" on public.seller_verifications for select to authenticated
using (seller_id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists "service participants view deliveries" on public.service_deliveries;
create policy "service participants view deliveries" on public.service_deliveries for select to authenticated
using (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or private.current_user_is_admin())
  )
);

drop policy if exists "admins resolve service disputes" on public.service_disputes;
create policy "admins resolve service disputes" on public.service_disputes for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

drop policy if exists "service participants view disputes" on public.service_disputes;
create policy "service participants view disputes" on public.service_disputes for select to authenticated
using (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or private.current_user_is_admin())
  )
);

drop policy if exists "service participants view milestones" on public.service_milestones;
create policy "service participants view milestones" on public.service_milestones for select to authenticated
using (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or private.current_user_is_admin())
  )
);

drop policy if exists "participants progress service projects" on public.service_projects;
create policy "participants progress service projects" on public.service_projects for update to authenticated
using (customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or private.current_user_is_admin())
with check (customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists "service participants view projects" on public.service_projects;
create policy "service participants view projects" on public.service_projects for select to authenticated
using (customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists "service participants view revisions" on public.service_revision_requests;
create policy "service participants view revisions" on public.service_revision_requests for select to authenticated
using (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or private.current_user_is_admin())
  )
);

drop policy if exists "admins view all shipments" on public.shipments;
create policy "admins view all shipments" on public.shipments for select to authenticated
using (private.current_user_is_admin());

drop policy if exists "owners and admins update stores" on public.stores;
create policy "owners and admins update stores" on public.stores for update to authenticated
using (owner_id = (select auth.uid()) or private.current_user_is_admin())
with check (owner_id = (select auth.uid()) or private.current_user_is_admin());

-- Cover all service-workspace foreign keys used by the workflow and admin review.
create index if not exists service_projects_product_id_idx on public.service_projects(product_id);
create index if not exists service_deliveries_milestone_id_idx on public.service_deliveries(milestone_id);
create index if not exists service_deliveries_submitted_by_idx on public.service_deliveries(submitted_by);
create index if not exists service_revision_requests_requested_by_idx on public.service_revision_requests(requested_by);
create index if not exists service_disputes_opened_by_idx on public.service_disputes(opened_by);
create index if not exists service_disputes_resolved_by_idx on public.service_disputes(resolved_by);

-- Keep a single select policy for milestones; separate write policies are clearer
-- and avoid evaluating overlapping permissive SELECT rules.
drop policy if exists "sellers manage active milestones" on public.service_milestones;

create policy "sellers add active milestones"
on public.service_milestones for insert to authenticated
with check (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and sp.seller_id = (select auth.uid())
      and sp.status in ('active', 'revision_requested')
  )
);

create policy "sellers update active milestones"
on public.service_milestones for update to authenticated
using (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and sp.seller_id = (select auth.uid())
      and sp.status in ('active', 'revision_requested')
  )
)
with check (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and sp.seller_id = (select auth.uid())
      and sp.status in ('active', 'revision_requested')
  )
);

create policy "sellers delete active milestones"
on public.service_milestones for delete to authenticated
using (
  exists (
    select 1 from public.service_projects sp
    where sp.id = project_id
      and sp.seller_id = (select auth.uid())
      and sp.status in ('active', 'revision_requested')
  )
);

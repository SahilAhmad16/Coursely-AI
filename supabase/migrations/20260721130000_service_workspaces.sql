-- Service projects are created from an existing customer/provider conversation.
-- Payment linkage is intentionally added later with the real checkout workflow.
do $$ begin
  create type public.service_project_status as enum ('requested', 'active', 'delivery_submitted', 'revision_requested', 'completed', 'disputed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.service_milestone_status as enum ('planned', 'in_progress', 'submitted', 'approved');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.service_dispute_status as enum ('open', 'under_review', 'resolved', 'dismissed');
exception when duplicate_object then null; end $$;

create table public.service_projects (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  customer_brief text not null check (char_length(customer_brief) between 20 and 3000),
  agreed_deadline date,
  revision_limit smallint not null default 0 check (revision_limit between 0 and 20),
  revisions_used smallint not null default 0 check (revisions_used between 0 and 20),
  status public.service_project_status not null default 'requested',
  last_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_project_participants_differ check (customer_id <> seller_id),
  constraint service_project_revision_limit check (revisions_used <= revision_limit)
);

create table public.service_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.service_projects(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 160),
  details text check (details is null or char_length(details) <= 1500),
  due_date date,
  position smallint not null default 0 check (position between 0 and 100),
  status public.service_milestone_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, position)
);

create table public.service_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.service_projects(id) on delete cascade,
  milestone_id uuid references public.service_milestones(id) on delete set null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  note text not null check (char_length(note) between 10 and 3000),
  created_at timestamptz not null default now()
);

create table public.service_revision_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.service_projects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  note text not null check (char_length(note) between 10 and 3000),
  status text not null default 'open' check (status in ('open', 'addressed', 'cancelled')),
  created_at timestamptz not null default now(),
  addressed_at timestamptz
);

create table public.service_disputes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.service_projects(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (reason in ('scope', 'delay', 'quality', 'communication', 'other')),
  details text not null check (char_length(details) between 10 and 3000),
  status public.service_dispute_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

create unique index service_revision_one_open_idx on public.service_revision_requests(project_id) where status = 'open';
create unique index service_dispute_one_open_idx on public.service_disputes(project_id) where status in ('open', 'under_review');
create index service_projects_customer_updated_idx on public.service_projects(customer_id, updated_at desc);
create index service_projects_seller_updated_idx on public.service_projects(seller_id, updated_at desc);
create index service_milestones_project_position_idx on public.service_milestones(project_id, position);
create index service_deliveries_project_created_idx on public.service_deliveries(project_id, created_at desc);

create or replace function public.touch_service_project_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger service_projects_updated_at before update on public.service_projects for each row execute procedure public.touch_service_project_updated_at();
create trigger service_milestones_updated_at before update on public.service_milestones for each row execute procedure public.touch_service_project_updated_at();

create or replace function public.validate_service_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare conversation_product_id uuid;
declare conversation_customer_id uuid;
declare conversation_seller_id uuid;
declare listing_type_value public.listing_type;
declare is_admin boolean;
begin
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') into is_admin;
  if tg_op = 'INSERT' then
    select c.product_id, c.customer_id, c.seller_id, p.listing_type into conversation_product_id, conversation_customer_id, conversation_seller_id, listing_type_value
    from public.conversations c join public.products p on p.id = c.product_id
    where c.id = new.conversation_id;
    if conversation_product_id is null or listing_type_value <> 'service' or auth.uid() <> conversation_customer_id then
      raise exception 'Only the customer in a service conversation can create a service project.';
    end if;
    if new.product_id <> conversation_product_id or new.customer_id <> conversation_customer_id or new.seller_id <> conversation_seller_id then
      raise exception 'Service project participants must match the conversation.';
    end if;
    new.status := 'requested';
    new.agreed_deadline := null;
    new.revisions_used := 0;
    return new;
  end if;

  if is_admin then return new; end if;
  if new.conversation_id <> old.conversation_id or new.product_id <> old.product_id or new.customer_id <> old.customer_id or new.seller_id <> old.seller_id or new.customer_brief <> old.customer_brief or new.revision_limit <> old.revision_limit then
    raise exception 'Service project details cannot be changed after the request is created.';
  end if;
  if auth.uid() = old.seller_id then
    if old.status = 'requested' and new.status = 'active' and new.agreed_deadline is not null and new.agreed_deadline >= current_date and new.revisions_used = old.revisions_used then return new; end if;
    if old.status in ('active', 'revision_requested') and new.status = 'delivery_submitted' and new.last_delivery_at is not null and new.revisions_used = old.revisions_used then return new; end if;
    if old.status in ('requested', 'active', 'revision_requested') and new.status = 'cancelled' and new.revisions_used = old.revisions_used then return new; end if;
    if old.status in ('requested', 'active', 'revision_requested', 'delivery_submitted') and new.status = 'disputed' and new.revisions_used = old.revisions_used then return new; end if;
  end if;
  if auth.uid() = old.customer_id then
    if old.status = 'delivery_submitted' and new.status = 'revision_requested' and new.revisions_used = old.revisions_used + 1 then return new; end if;
    if old.status = 'delivery_submitted' and new.status = 'completed' and new.revisions_used = old.revisions_used then return new; end if;
    if old.status in ('requested', 'active') and new.status = 'cancelled' and new.revisions_used = old.revisions_used then return new; end if;
    if old.status in ('requested', 'active', 'revision_requested', 'delivery_submitted') and new.status = 'disputed' and new.revisions_used = old.revisions_used then return new; end if;
  end if;
  raise exception 'This service project state change is not allowed.';
end;
$$;
revoke all on function public.validate_service_project() from public;
create trigger service_projects_validate before insert or update on public.service_projects for each row execute procedure public.validate_service_project();

alter table public.service_projects enable row level security;
alter table public.service_milestones enable row level security;
alter table public.service_deliveries enable row level security;
alter table public.service_revision_requests enable row level security;
alter table public.service_disputes enable row level security;
grant select, insert, update on public.service_projects to authenticated;
grant select, insert, update, delete on public.service_milestones to authenticated;
grant select, insert on public.service_deliveries to authenticated;
grant select, insert, update on public.service_revision_requests to authenticated;
grant select, insert, update on public.service_disputes to authenticated;

create policy "service participants view projects" on public.service_projects for select to authenticated using (customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "customers request service projects" on public.service_projects for insert to authenticated with check (customer_id = (select auth.uid()));
create policy "participants progress service projects" on public.service_projects for update to authenticated using (customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (customer_id = (select auth.uid()) or seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "service participants view milestones" on public.service_milestones for select to authenticated using (exists (select 1 from public.service_projects sp where sp.id = project_id and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))));
create policy "sellers manage active milestones" on public.service_milestones for all to authenticated using (exists (select 1 from public.service_projects sp where sp.id = project_id and sp.seller_id = (select auth.uid()) and sp.status in ('active', 'revision_requested'))) with check (exists (select 1 from public.service_projects sp where sp.id = project_id and sp.seller_id = (select auth.uid()) and sp.status in ('active', 'revision_requested')));

create policy "service participants view deliveries" on public.service_deliveries for select to authenticated using (exists (select 1 from public.service_projects sp where sp.id = project_id and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))));
create policy "sellers submit deliveries" on public.service_deliveries for insert to authenticated with check (submitted_by = (select auth.uid()) and exists (select 1 from public.service_projects sp where sp.id = project_id and sp.seller_id = (select auth.uid()) and sp.status in ('active', 'revision_requested')));

create policy "service participants view revisions" on public.service_revision_requests for select to authenticated using (exists (select 1 from public.service_projects sp where sp.id = project_id and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))));
create policy "customers request revisions" on public.service_revision_requests for insert to authenticated with check (requested_by = (select auth.uid()) and exists (select 1 from public.service_projects sp where sp.id = project_id and sp.customer_id = (select auth.uid()) and sp.status = 'delivery_submitted' and sp.revisions_used < sp.revision_limit));
create policy "sellers address revisions" on public.service_revision_requests for update to authenticated using (exists (select 1 from public.service_projects sp where sp.id = project_id and sp.seller_id = (select auth.uid()))) with check (exists (select 1 from public.service_projects sp where sp.id = project_id and sp.seller_id = (select auth.uid())));

create policy "service participants view disputes" on public.service_disputes for select to authenticated using (exists (select 1 from public.service_projects sp where sp.id = project_id and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid()) or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))));
create policy "service participants open disputes" on public.service_disputes for insert to authenticated with check (opened_by = (select auth.uid()) and exists (select 1 from public.service_projects sp where sp.id = project_id and (sp.customer_id = (select auth.uid()) or sp.seller_id = (select auth.uid())) and sp.status not in ('completed', 'cancelled')));
create policy "admins resolve service disputes" on public.service_disputes for update to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

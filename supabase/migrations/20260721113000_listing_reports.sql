create type public.listing_report_status as enum ('open', 'resolved', 'dismissed');

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('misleading', 'copyright', 'unsafe', 'spam', 'other')),
  details text check (char_length(details) <= 1000),
  status public.listing_report_status not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(product_id, reporter_id)
);

create index listing_reports_status_created_idx on public.listing_reports(status, created_at desc);
alter table public.listing_reports enable row level security;
grant insert, select on public.listing_reports to authenticated;
grant update on public.listing_reports to authenticated;

create policy "reporters view own listing reports" on public.listing_reports for select to authenticated
using (reporter_id = (select auth.uid()));
create policy "admins view listing reports" on public.listing_reports for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "users report published listings" on public.listing_reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy "admins resolve listing reports" on public.listing_reports for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

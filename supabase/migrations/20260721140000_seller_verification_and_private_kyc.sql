-- Seller KYC / business-verification records. Documents stay private and can
-- only be read by their owner or a Coursely AI administrator.
create type public.seller_verification_status as enum (
  'submitted',
  'approved',
  'changes_requested',
  'rejected'
);

create table public.seller_verifications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 2 and 120),
  business_type text not null check (business_type in ('individual', 'sole_proprietor', 'partnership', 'company')),
  document_kind text not null check (document_kind in ('pan', 'gst', 'business_registration', 'government_id', 'other')),
  document_last4 text not null check (document_last4 ~ '^[A-Za-z0-9]{4}$'),
  address_line text not null check (char_length(address_line) between 10 and 500),
  document_path text not null unique,
  status public.seller_verification_status not null default 'submitted',
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seller_verifications_status_submitted_idx
  on public.seller_verifications(status, submitted_at asc);
create index seller_verifications_store_idx on public.seller_verifications(store_id);

create trigger seller_verifications_updated_at
  before update on public.seller_verifications
  for each row execute procedure public.touch_updated_at();

-- Store owners must never be able to mark their own store as verified.
create or replace function public.protect_store_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_verified is distinct from old.is_verified and not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    raise exception 'Only an administrator can change store verification.';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_store_verification() from public;

create trigger stores_protect_verification
  before update on public.stores
  for each row execute procedure public.protect_store_verification();

create or replace function public.guard_seller_verification_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.seller_id <> (select auth.uid())
      or new.status <> 'submitted'
      or new.review_note is not null
      or new.reviewed_at is not null
      or new.reviewed_by is not null then
      raise exception 'Sellers can only submit their own verification request.';
    end if;
    return new;
  end if;

  if old.seller_id <> (select auth.uid())
    or old.status not in ('changes_requested', 'rejected')
    or new.seller_id <> old.seller_id
    or new.store_id <> old.store_id
    or new.status <> 'submitted'
    or new.review_note is not null
    or new.reviewed_at is not null
    or new.reviewed_by is not null then
    raise exception 'This verification request cannot be changed right now.';
  end if;
  new.submitted_at = now();
  return new;
end;
$$;
revoke all on function public.guard_seller_verification_write() from public;

create trigger seller_verifications_write_guard
  before insert or update on public.seller_verifications
  for each row execute procedure public.guard_seller_verification_write();

alter table public.seller_verifications enable row level security;
grant select, insert, update on public.seller_verifications to authenticated;

create policy "sellers view own verification" on public.seller_verifications
  for select to authenticated
  using (seller_id = (select auth.uid()));
create policy "admins view seller verifications" on public.seller_verifications
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));
create policy "sellers submit own verification" on public.seller_verifications
  for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.stores s
      where s.id = store_id and s.owner_id = (select auth.uid())
    )
  );
create policy "sellers resubmit own verification" on public.seller_verifications
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.stores s
      where s.id = store_id and s.owner_id = (select auth.uid())
    )
  );
create policy "admins review seller verifications" on public.seller_verifications
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-kyc', 'seller-kyc', false, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "sellers upload own KYC documents" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'seller-kyc'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "sellers view own KYC documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'seller-kyc'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "sellers delete own KYC documents" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'seller-kyc'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "admins view KYC documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'seller-kyc'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

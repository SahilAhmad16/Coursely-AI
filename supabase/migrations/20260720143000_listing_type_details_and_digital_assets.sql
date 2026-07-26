-- Keep type-specific seller information structured without exposing paid files publicly.
alter table public.products
  add column if not exists listing_details jsonb not null default '{}'::jsonb,
  add column if not exists digital_file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-assets',
  'digital-assets',
  false,
  104857600,
  array[
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'audio/mpeg'
  ]
)
on conflict (id) do nothing;

drop policy if exists "digital sellers upload own assets" on storage.objects;
create policy "digital sellers upload own assets" on storage.objects for insert to authenticated
with check (
  bucket_id = 'digital-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "digital sellers view own assets" on storage.objects;
create policy "digital sellers view own assets" on storage.objects for select to authenticated
using (
  bucket_id = 'digital-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "digital sellers replace own assets" on storage.objects;
create policy "digital sellers replace own assets" on storage.objects for update to authenticated
using (
  bucket_id = 'digital-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'digital-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "digital sellers delete own assets" on storage.objects;
create policy "digital sellers delete own assets" on storage.objects for delete to authenticated
using (
  bucket_id = 'digital-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

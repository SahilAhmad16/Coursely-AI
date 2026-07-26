-- Seller storefront visuals and participant-only service-chat file sharing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets', 'store-assets', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 160),
  mime_type text not null check (char_length(mime_type) between 1 and 120),
  byte_size integer not null check (byte_size > 0 and byte_size <= 26214400),
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_message_idx on public.message_attachments(message_id);
alter table public.message_attachments enable row level security;
grant select, insert on public.message_attachments to authenticated;

create policy "conversation participants view attachments" on public.message_attachments for select to authenticated
using (exists (
  select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
  where m.id = message_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.seller_id)
));
create policy "participants attach own files" on public.message_attachments for insert to authenticated
with check (sender_id = (select auth.uid()) and exists (
  select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
  where m.id = message_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.seller_id)
));

drop policy if exists "store owners upload assets" on storage.objects;
create policy "store owners upload assets" on storage.objects for insert to authenticated
with check (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "store owners manage assets" on storage.objects;
create policy "store owners manage assets" on storage.objects for all to authenticated
using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "published store assets are readable" on storage.objects;
create policy "published store assets are readable" on storage.objects for select
using (bucket_id = 'store-assets' and exists (
  select 1 from public.stores s
  where (s.logo_path = name or s.banner_path = name)
    and exists (select 1 from public.products p where p.store_id = s.id and p.status = 'published')
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-files', 'message-files', false, 26214400,
  array['application/pdf', 'application/zip', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv', 'video/mp4', 'audio/mpeg']
)
on conflict (id) do nothing;

drop policy if exists "conversation participants upload files" on storage.objects;
create policy "conversation participants upload files" on storage.objects for insert to authenticated
with check (bucket_id = 'message-files' and (storage.foldername(name))[2] = (select auth.uid())::text and exists (
  select 1 from public.conversations c
  where c.id::text = (storage.foldername(name))[1]
    and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.seller_id)
));
drop policy if exists "conversation participants view files" on storage.objects;
create policy "conversation participants view files" on storage.objects for select to authenticated
using (bucket_id = 'message-files' and exists (
  select 1 from public.conversations c
  where c.id::text = (storage.foldername(name))[1]
    and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.seller_id)
));
drop policy if exists "conversation participants delete own files" on storage.objects;
create policy "conversation participants delete own files" on storage.objects for delete to authenticated
using (bucket_id = 'message-files' and (storage.foldername(name))[2] = (select auth.uid())::text);

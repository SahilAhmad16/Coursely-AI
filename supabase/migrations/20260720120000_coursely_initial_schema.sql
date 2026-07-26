-- Coursely AI core marketplace schema. Apply only through Supabase migration tooling.
create extension if not exists pgcrypto;

create type public.account_role as enum ('buyer', 'seller', 'admin');
create type public.listing_type as enum ('digital', 'physical', 'service', 'affiliate');
create type public.listing_status as enum ('draft', 'pending_review', 'published', 'archived', 'rejected');
create type public.order_status as enum ('pending_payment', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text unique,
  avatar_path text,
  phone text,
  role public.account_role not null default 'buyer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9][a-z0-9_-]{2,29}$')
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  logo_path text,
  banner_path text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$')
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text not null default '',
  listing_type public.listing_type not null,
  status public.listing_status not null default 'draft',
  price_paise integer not null check (price_paise >= 0),
  compare_at_paise integer check (compare_at_paise is null or compare_at_paise >= price_paise),
  currency char(3) not null default 'INR',
  thumbnail_path text,
  banner_path text,
  digital_file_path text,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  requires_shipping boolean not null default false,
  service_delivery_days integer check (service_delivery_days is null or service_delivery_days > 0),
  external_source text,
  external_listing_url text,
  affiliate_disclosure text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint physical_requires_shipping check (listing_type <> 'physical' or requires_shipping),
  constraint affiliate_requires_source check (listing_type <> 'affiliate' or (external_source is not null and external_listing_url is not null))
);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,
  alt_text text,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, position)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  order_number bigint generated always as identity unique,
  status public.order_status not null default 'pending_payment',
  currency char(3) not null default 'INR',
  subtotal_paise integer not null check (subtotal_paise >= 0),
  tax_paise integer not null default 0 check (tax_paise >= 0),
  shipping_paise integer not null default 0 check (shipping_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  payment_provider text,
  payment_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  seller_id uuid not null references public.profiles(id),
  title_snapshot text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  courier text,
  tracking_number text unique,
  tracking_url text,
  status text not null default 'pending',
  shipping_address jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique(product_id, buyer_id)
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
create trigger stores_updated_at before update on public.stores for each row execute procedure public.touch_updated_at();
create trigger products_updated_at before update on public.products for each row execute procedure public.touch_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute procedure public.touch_updated_at();
create trigger shipments_updated_at before update on public.shipments for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.reviews enable row level security;

grant select on public.profiles, public.stores, public.categories, public.products, public.product_media, public.reviews to anon, authenticated;
grant insert, update, delete on public.profiles, public.stores, public.products, public.product_media, public.reviews to authenticated;
grant select on public.orders, public.order_items, public.shipments to authenticated;

create policy "public profiles visible" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "stores public or owned" on public.stores for select using (true);
create policy "users create own store" on public.stores for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "owners update own store" on public.stores for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "categories public" on public.categories for select using (is_active);
create policy "published products public" on public.products for select using (status = 'published' or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
create policy "owners create products" on public.products for insert to authenticated with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
create policy "owners update products" on public.products for update to authenticated using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid()))) with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
create policy "owners delete products" on public.products for delete to authenticated using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = (select auth.uid())));
create policy "media public or owned" on public.product_media for select using (
  exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
  or exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid()))
);
create policy "owners manage product media" on public.product_media for all to authenticated using (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid()))) with check (exists (select 1 from public.products p join public.stores s on s.id = p.store_id where p.id = product_id and s.owner_id = (select auth.uid())));
create policy "buyers see own orders" on public.orders for select to authenticated using ((select auth.uid()) = buyer_id);
create policy "buyers see own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())) or seller_id = (select auth.uid()));
create policy "buyers see own shipments" on public.shipments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())));
create policy "reviews public" on public.reviews for select using (true);
create policy "buyers create own reviews" on public.reviews for insert to authenticated with check ((select auth.uid()) = buyer_id and exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.product_id = reviews.product_id and o.buyer_id = (select auth.uid()) and o.status = 'fulfilled'));
create policy "buyers update own reviews" on public.reviews for update to authenticated using ((select auth.uid()) = buyer_id) with check ((select auth.uid()) = buyer_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media', 'product-media', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "authenticated sellers upload own media" on storage.objects for insert to authenticated with check (bucket_id = 'product-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "authenticated sellers view own media" on storage.objects for select to authenticated using (bucket_id = 'product-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "authenticated sellers update own media" on storage.objects for update to authenticated using (bucket_id = 'product-media' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'product-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "authenticated sellers delete own media" on storage.objects for delete to authenticated using (bucket_id = 'product-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "published product previews are readable" on storage.objects for select using (
  bucket_id = 'product-media'
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[2]
      and p.status = 'published'
  )
);

insert into public.categories (name, slug) values
  ('Digital products', 'digital-products'), ('Professional services', 'professional-services'), ('Physical products', 'physical-products'), ('Courses', 'courses'), ('Design assets', 'design-assets'), ('Software and templates', 'software-templates')
on conflict (slug) do nothing;

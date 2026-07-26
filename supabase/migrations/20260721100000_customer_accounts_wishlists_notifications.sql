-- Customer account tools that work independently of the payment-provider phase.
alter table public.profiles
  add column if not exists bio text not null default '' check (char_length(bio) <= 500);

create table if not exists public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),
  phone text not null check (char_length(phone) between 7 and 20),
  line1 text not null check (char_length(line1) between 5 and 160),
  line2 text,
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  postal_code text not null check (char_length(postal_code) between 3 and 16),
  country_code char(2) not null default 'IN',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('listing', 'account', 'system')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wishlists_user_created_idx on public.wishlists(user_id, created_at desc);
create index if not exists saved_addresses_user_created_idx on public.saved_addresses(user_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

drop trigger if exists saved_addresses_updated_at on public.saved_addresses;
create trigger saved_addresses_updated_at before update on public.saved_addresses for each row execute procedure public.touch_updated_at();

alter table public.wishlists enable row level security;
alter table public.saved_addresses enable row level security;
alter table public.notifications enable row level security;

grant select, insert, delete on public.wishlists to authenticated;
grant select, insert, update, delete on public.saved_addresses to authenticated;
grant select, update on public.notifications to authenticated;
grant insert on public.notifications to authenticated;

create policy "users manage own wishlists" on public.wishlists for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users manage own saved addresses" on public.saved_addresses for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users view own notifications" on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);
create policy "users mark own notifications read" on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "admins create notifications" on public.notifications for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

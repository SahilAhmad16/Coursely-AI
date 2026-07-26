create type public.support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.coupon_discount_type as enum ('percent', 'fixed');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('account', 'seller', 'listing', 'payment', 'digital_delivery', 'service', 'affiliate', 'other')),
  subject text not null check (char_length(subject) between 5 and 140),
  message text not null check (char_length(message) between 20 and 4000),
  status public.support_ticket_status not null default 'open',
  admin_note text check (admin_note is null or char_length(admin_note) <= 4000),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  discount_type public.coupon_discount_type not null,
  discount_value integer not null check (discount_value > 0),
  minimum_order_paise integer not null default 0 check (minimum_order_paise >= 0),
  maximum_uses integer check (maximum_uses is null or maximum_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupon_value_matches_type check (
    (discount_type = 'percent' and discount_value between 1 and 10000)
    or (discount_type = 'fixed' and discount_value <= 100000000)
  ),
  constraint coupon_dates_valid check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table public.promotional_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 100),
  subtitle text check (subtitle is null or char_length(subtitle) <= 240),
  href text check (href is null or href ~ '^/'),
  placement text not null default 'marketplace' check (placement in ('home', 'marketplace')),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banner_dates_valid check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index support_tickets_user_created_idx on public.support_tickets(user_id, created_at desc);
create index support_tickets_status_created_idx on public.support_tickets(status, created_at);
create index coupons_active_code_idx on public.coupons(is_active, code);
create index promotional_banners_active_idx on public.promotional_banners(placement, is_active, starts_at, ends_at);

create trigger support_tickets_updated_at before update on public.support_tickets
for each row execute procedure public.touch_updated_at();
create trigger coupons_updated_at before update on public.coupons
for each row execute procedure public.touch_updated_at();
create trigger promotional_banners_updated_at before update on public.promotional_banners
for each row execute procedure public.touch_updated_at();

alter table public.support_tickets enable row level security;
alter table public.coupons enable row level security;
alter table public.promotional_banners enable row level security;

grant select, insert on public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;
grant select on public.coupons to authenticated;
grant select on public.promotional_banners to anon, authenticated;
grant insert, update, delete on public.coupons to authenticated;
grant insert, update, delete on public.promotional_banners to authenticated;

create policy "users create own support tickets"
on public.support_tickets for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'open'
  and admin_note is null
  and assigned_to is null
  and resolved_at is null
);

create policy "users and admins view support tickets"
on public.support_tickets for select to authenticated
using (user_id = (select auth.uid()) or private.current_user_is_admin());

create policy "admins update support tickets"
on public.support_tickets for update to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

create policy "authenticated users view active coupons"
on public.coupons for select to authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
  or private.current_user_is_admin()
);

create policy "admins manage coupons"
on public.coupons for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

create policy "public views active promotional banners"
on public.promotional_banners for select
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

create policy "admins manage promotional banners"
on public.promotional_banners for all to authenticated
using (private.current_user_is_admin())
with check (private.current_user_is_admin());

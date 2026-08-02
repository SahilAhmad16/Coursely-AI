-- Seller payout destinations, wallet balances, and withdrawal requests.
-- Transfers are admin-controlled until a payout provider is connected.

create table public.seller_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null unique references public.profiles(id) on delete cascade,
  method text not null check (method in ('upi', 'bank')),
  account_holder_name text not null check (char_length(account_holder_name) between 2 and 100),
  upi_id text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verification_note text check (verification_note is null or char_length(verification_note) <= 1000),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_destination_matches_method check (
    (method = 'upi' and upi_id ~* '^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$' and bank_account_number is null and bank_ifsc is null)
    or
    (method = 'bank' and bank_account_number ~ '^[0-9]{6,24}$' and bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$' and upi_id is null)
  )
);

create table public.seller_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  payout_account_id uuid not null references public.seller_payout_accounts(id) on delete restrict,
  amount_paise integer not null check (amount_paise >= 10000),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status text not null default 'requested' check (status in ('requested', 'processing', 'paid', 'rejected', 'cancelled', 'failed')),
  payout_provider text not null default 'manual',
  provider_payout_id text,
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index seller_payout_accounts_verification_idx on public.seller_payout_accounts(verification_status, updated_at);
create index seller_withdrawals_seller_created_idx on public.seller_withdrawal_requests(seller_id, created_at desc);
create index seller_withdrawals_status_requested_idx on public.seller_withdrawal_requests(status, requested_at);

create trigger seller_payout_accounts_updated_at
before update on public.seller_payout_accounts
for each row execute procedure public.touch_updated_at();

create trigger seller_withdrawals_updated_at
before update on public.seller_withdrawal_requests
for each row execute procedure public.touch_updated_at();

alter table public.seller_payout_accounts enable row level security;
alter table public.seller_withdrawal_requests enable row level security;

grant select on public.seller_payout_accounts, public.seller_withdrawal_requests to authenticated;

create policy "sellers view own payout account"
on public.seller_payout_accounts for select to authenticated
using (seller_id = (select auth.uid()));

create policy "admins view payout accounts"
on public.seller_payout_accounts for select to authenticated
using (private.current_user_is_admin());

create policy "sellers view own withdrawals"
on public.seller_withdrawal_requests for select to authenticated
using (seller_id = (select auth.uid()));

create policy "admins view withdrawals"
on public.seller_withdrawal_requests for select to authenticated
using (private.current_user_is_admin());

create or replace function public.request_seller_withdrawal(p_amount_paise integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  destination public.seller_payout_accounts%rowtype;
  earned_paise bigint;
  reserved_paise bigint;
  request_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;
  if p_amount_paise < 10000 then raise exception 'Minimum withdrawal is INR 100.'; end if;

  perform 1 from public.profiles where id = current_user_id for update;

  select * into destination
  from public.seller_payout_accounts
  where seller_id = current_user_id and verification_status = 'verified';
  if not found then raise exception 'A verified payout account is required.'; end if;

  select coalesce(sum(seller_net_paise), 0) into earned_paise
  from public.platform_ledger
  where seller_id = current_user_id and status in ('earned', 'settled');

  select coalesce(sum(amount_paise), 0) into reserved_paise
  from public.seller_withdrawal_requests
  where seller_id = current_user_id and status in ('requested', 'processing', 'paid');

  if p_amount_paise > earned_paise - reserved_paise then
    raise exception 'Withdrawal amount exceeds the available balance.';
  end if;

  insert into public.seller_withdrawal_requests (seller_id, payout_account_id, amount_paise)
  values (current_user_id, destination.id, p_amount_paise)
  returning id into request_id;

  insert into public.notifications (user_id, kind, title, body, href)
  values (current_user_id, 'account', 'Withdrawal requested', 'Your withdrawal request is waiting for Coursely AI review.', '/dashboard');

  return request_id;
end;
$$;

revoke all on function public.request_seller_withdrawal(integer) from public;
grant execute on function public.request_seller_withdrawal(integer) to authenticated;

create or replace function public.cancel_seller_withdrawal(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;

  update public.seller_withdrawal_requests
  set status = 'cancelled'
  where id = p_request_id and seller_id = current_user_id and status = 'requested';

  return found;
end;
$$;

revoke all on function public.cancel_seller_withdrawal(uuid) from public;
grant execute on function public.cancel_seller_withdrawal(uuid) to authenticated;

comment on table public.seller_payout_accounts is 'Seller-owned payout destination. Updates require renewed admin verification.';
comment on table public.seller_withdrawal_requests is 'Seller withdrawal queue. Manual now; compatible with a future Cashfree Payouts transfer ID.';

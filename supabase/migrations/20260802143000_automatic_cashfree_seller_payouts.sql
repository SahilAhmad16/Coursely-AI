-- Automatic Cashfree Payouts V2 seller withdrawals.
-- The application reserves the seller balance before initiating an external
-- transfer. Cashfree webhooks then move the request to a terminal state.

alter table public.seller_payout_accounts
  add column provider_beneficiary_id text,
  add column provider_status text,
  add column provider_response jsonb not null default '{}'::jsonb;

create unique index seller_payout_accounts_provider_beneficiary_idx
on public.seller_payout_accounts(provider_beneficiary_id)
where provider_beneficiary_id is not null;

alter table public.seller_withdrawal_requests
  add column provider_transfer_id text,
  add column provider_status text,
  add column provider_status_code text,
  add column provider_utr text,
  add column provider_response jsonb not null default '{}'::jsonb;

create unique index seller_withdrawals_provider_transfer_idx
on public.seller_withdrawal_requests(provider_transfer_id)
where provider_transfer_id is not null;

drop function if exists public.cancel_seller_withdrawal(uuid);

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
  transfer_id text;
begin
  if current_user_id is null then raise exception 'Authentication required.'; end if;
  if p_amount_paise < 10000 then raise exception 'Minimum withdrawal is INR 100.'; end if;

  perform 1 from public.profiles where id = current_user_id for update;

  select * into destination
  from public.seller_payout_accounts
  where seller_id = current_user_id
    and verification_status = 'verified'
    and provider_beneficiary_id is not null;
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

  request_id := gen_random_uuid();
  transfer_id := 'cw_' || replace(request_id::text, '-', '');

  insert into public.seller_withdrawal_requests (
    id, seller_id, payout_account_id, amount_paise, status,
    payout_provider, provider_transfer_id, provider_status
  ) values (
    request_id, current_user_id, destination.id, p_amount_paise, 'processing',
    'cashfree_payouts', transfer_id, 'CREATED'
  );

  insert into public.notifications (user_id, kind, title, body, href)
  values (current_user_id, 'account', 'Automatic payout started', 'Cashfree is processing your withdrawal. The final status will update automatically.', '/dashboard#seller-wallet');

  return request_id;
end;
$$;

revoke all on function public.request_seller_withdrawal(integer) from public;
grant execute on function public.request_seller_withdrawal(integer) to authenticated;

comment on table public.seller_payout_accounts is 'Seller payout destination and Cashfree beneficiary verification state.';
comment on table public.seller_withdrawal_requests is 'Automatic Cashfree Payouts transfers; terminal state is reconciled by signed webhooks.';

-- Charge the payout provider fee to the withdrawing seller, without reducing
-- Coursely AI commission. The seller receives amount_paise while the wallet
-- reserves amount_paise + withdrawal_fee_paise.

alter table public.seller_withdrawal_requests
  add column withdrawal_fee_paise integer not null default 0
  check (withdrawal_fee_paise >= 0);

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
  base_fee_paise integer;
  fee_paise integer;
  total_debit_paise bigint;
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

  base_fee_paise := case
    when destination.method = 'upi' and p_amount_paise <= 100000 then 600
    when destination.method = 'upi' and p_amount_paise <= 2500000 then 800
    when destination.method = 'upi' then 1500
    when p_amount_paise <= 100000 then 300
    when p_amount_paise <= 2500000 then 500
    else 800
  end;
  fee_paise := ((base_fee_paise * 118) + 99) / 100;
  total_debit_paise := p_amount_paise::bigint + fee_paise::bigint;

  select coalesce(sum(seller_net_paise), 0) into earned_paise
  from public.platform_ledger
  where seller_id = current_user_id and status in ('earned', 'settled');

  select coalesce(sum(amount_paise::bigint + withdrawal_fee_paise::bigint), 0) into reserved_paise
  from public.seller_withdrawal_requests
  where seller_id = current_user_id and status in ('requested', 'processing', 'paid');

  if total_debit_paise > earned_paise - reserved_paise then
    raise exception 'Withdrawal amount plus payout fee exceeds the available balance.';
  end if;

  request_id := gen_random_uuid();
  transfer_id := 'cw_' || replace(request_id::text, '-', '');

  insert into public.seller_withdrawal_requests (
    id, seller_id, payout_account_id, amount_paise, withdrawal_fee_paise, status,
    payout_provider, provider_transfer_id, provider_status
  ) values (
    request_id, current_user_id, destination.id, p_amount_paise, fee_paise, 'processing',
    'cashfree_payouts', transfer_id, 'CREATED'
  );

  insert into public.notifications (user_id, kind, title, body, href)
  values (
    current_user_id,
    'account',
    'Automatic payout started',
    'Cashfree is processing your withdrawal. The payout fee is charged to your seller wallet and the final status updates automatically.',
    '/dashboard#seller-wallet'
  );

  return request_id;
end;
$$;

revoke all on function public.request_seller_withdrawal(integer) from public, anon;
grant execute on function public.request_seller_withdrawal(integer) to authenticated;

comment on column public.seller_withdrawal_requests.withdrawal_fee_paise is
  'Cashfree standard payout charge plus GST, funded by the seller wallet. Refunded to wallet automatically when the transfer fails.';

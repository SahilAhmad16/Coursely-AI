-- Cover payout foreign keys and combine equivalent SELECT policies so each
-- table evaluates only one permissive policy per authenticated request.
create index seller_payout_accounts_verified_by_idx on public.seller_payout_accounts(verified_by) where verified_by is not null;
create index seller_withdrawals_payout_account_idx on public.seller_withdrawal_requests(payout_account_id);
create index seller_withdrawals_processed_by_idx on public.seller_withdrawal_requests(processed_by) where processed_by is not null;

drop policy if exists "sellers view own payout account" on public.seller_payout_accounts;
drop policy if exists "admins view payout accounts" on public.seller_payout_accounts;
create policy "owners and admins view payout accounts"
on public.seller_payout_accounts for select to authenticated
using (seller_id = (select auth.uid()) or private.current_user_is_admin());

drop policy if exists "sellers view own withdrawals" on public.seller_withdrawal_requests;
drop policy if exists "admins view withdrawals" on public.seller_withdrawal_requests;
create policy "owners and admins view withdrawals"
on public.seller_withdrawal_requests for select to authenticated
using (seller_id = (select auth.uid()) or private.current_user_is_admin());

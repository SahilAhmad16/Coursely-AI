# Cashfree automatic seller payouts

Coursely AI keeps platform subscription receipts and the configured platform
commission in the owner's payment-gateway merchant account. Only the seller's
net ledger balance is withdrawable.

Seller withdrawals do not require a Coursely admin approval. A seller first
saves a UPI ID or bank account. Cashfree verifies it as a beneficiary. When the
seller selects **Withdraw**, Coursely reserves that amount and sends an
asynchronous Cashfree Payouts V2 transfer. Signed webhooks update the final
status and UTR automatically. Failed or reversed transfers release the amount
back into the seller's available balance.

## Required production configuration

Activate Cashfree Payouts separately from the Cashfree Payment Gateway. Do not
reuse Payment Gateway keys; Payouts has its own client ID and secret.

Add these server-side environment variables in Vercel Production:

```text
CASHFREE_PAYOUT_CLIENT_ID=<Cashfree Payouts production client ID>
CASHFREE_PAYOUT_CLIENT_SECRET=<Cashfree Payouts production client secret>
CASHFREE_PAYOUT_WEBHOOK_SECRET=<oldest active Cashfree Payouts client secret>
CASHFREE_PAYOUT_ENVIRONMENT=production
```

Never prefix these variables with `NEXT_PUBLIC_` and never commit their values.

Configure this Payouts V2 webhook URL in Cashfree:

```text
https://coursely-ai-production.vercel.app/api/webhooks/cashfree-payouts
```

Subscribe to these transfer events:

- `TRANSFER_ACKNOWLEDGED`
- `TRANSFER_SUCCESS`
- `TRANSFER_FAILED`
- `TRANSFER_REVERSED`
- `TRANSFER_REJECTED`

Redeploy Production after adding or changing environment variables.

## Operational requirement

This integration uses Cashfree Payouts, not Easy Split. Customer payments and
seller payouts are separate money movements. The owner must keep enough
available balance in the Cashfree Payouts account for seller withdrawals.
Cashfree and banking charges, KYC, limits, holds, and compliance checks still
apply. A Cashfree provider-side `APPROVAL_PENDING` or compliance hold is not a
Coursely admin approval.

Currently supported seller destinations are UPI and Indian bank transfer. A
generic "other" destination is intentionally not accepted because it cannot be
verified or paid safely; Cashgram or card payouts can be added after Cashfree
enables those products on the merchant account.

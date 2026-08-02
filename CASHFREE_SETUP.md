# Cashfree setup for Coursely AI

The application code starts in Cashfree sandbox mode. Do not place API credentials in source code, GitHub, screenshots, or chat.

## Seller withdrawals

Coursely AI keeps a separate seller wallet and withdrawal-request ledger. Sellers can submit a UPI ID or Indian bank account, and an administrator must verify it before withdrawals unlock.

Until Cashfree Payouts or Easy Split is approved for the merchant account, payouts are processed manually: transfer the approved amount from the platform bank account, enter the UPI/bank reference in the admin panel, and only then mark the request as paid. Never mark a request paid before the external transfer succeeds.

When Cashfree Payouts is activated, the same withdrawal record can store the provider transfer ID in `provider_payout_id`; the seller wallet does not need to be redesigned.

## Vercel environment variables

Add these in the Coursely AI Vercel project under Settings -> Environment Variables:

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard -> Project Settings -> API Keys -> service role key.
- `CASHFREE_CLIENT_ID`: Cashfree Payments Dashboard API key.
- `CASHFREE_CLIENT_SECRET`: Cashfree Payments Dashboard API secret.
- `CASHFREE_ENVIRONMENT`: use `sandbox` until all tests pass; change to `production` only with live Cashfree keys.
- `NEXT_PUBLIC_SITE_URL`: `https://coursely-ai-production.vercel.app`

Apply sensitive variables to Production, Preview, and Development as appropriate, then redeploy. Never prefix secrets with `NEXT_PUBLIC_`.

## Cashfree dashboard configuration

1. Whitelist `https://coursely-ai-production.vercel.app` as the website domain.
2. Add this payment webhook endpoint:
   `https://coursely-ai-production.vercel.app/api/webhooks/cashfree`
3. Subscribe to payment success, failed, and user-dropped events.
4. Complete sandbox payments first and verify the order, seller plan, platform ledger, and digital download behavior.
5. Activate production only after Cashfree KYC and website approval are complete.

## Implemented safety controls

- Product and plan prices are loaded from the database on the server, not trusted from the browser.
- Affiliate Products cannot enter Coursely AI checkout.
- Signed Cashfree webhooks are verified from the raw request body.
- Amount and currency must match the stored payment attempt.
- Payment settlement is idempotent and restricted to the Supabase service role.
- Digital files use short-lived signed URLs and require the buyer's paid order.
- A failed or interrupted payment never activates an order or seller plan.

Official references:

- [Cashfree hosted web checkout](https://www.cashfree.com/docs/payments/online/web/redirect)
- [Create Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create-order)
- [Webhook signature verification](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification)

# Coursely AI

Coursely AI is a marketplace with three seller paths:

1. Digital Products sold and delivered through Coursely AI.
2. Professional Services delivered through a customer-provider workflow.
3. Products shown with approved affiliate links. The partner platform handles payment, delivery, tracking, returns, and affiliate earnings.

Coursely AI does not accept or ship physical inventory directly.

## Seller pricing

- Every seller category receives its first 28 days free.
- Professional Services: ₹50 per 28 days, with no per-sale commission.
- Digital Products: ₹60 per 28 days, plus 10% on confirmed digital sales completed through Coursely AI.
- Product Affiliate: ₹50 per 28 days. Coursely AI does not deduct a sale commission because checkout happens on the partner platform.
- An expired required plan locks the affected seller tools and listings until renewal is confirmed.

The database retains the legacy internal plan value `physical` for migration compatibility. In the user interface it always means the Product Affiliate seller plan.

## Implemented locally

- Email/password and Google authentication through Supabase, password reset, protected account and seller routes.
- Buyer profile, saved addresses, wishlist, cart, marketplace search and filters.
- Seller application and verification, store profile/logo/banner, separate listing forms, private digital files, media uploads, and admin listing review.
- Professional-service conversations, file attachments, projects, milestones, delivery/revision/dispute states.
- Admin views for users, sellers, listings, orders, payments, subscriptions, reports, coupons, banners, disputes, tickets, and audit logs.
- Database RLS, role checks, seller-plan locks, digital-sale commission ledger, private storage, and rate-limit tables.
- Free smart-help chatbot with local marketplace knowledge, quick questions, relevant page links, unknown-question fallback, and no paid API dependency.

## Run locally on Windows

Open a terminal in this folder and run:

```powershell
npm.cmd run dev
```

Then open `http://localhost:3000`. Keep that terminal open while using the website.

## Environment variables

Copy `.env.example` to `.env.local` and add the required Supabase public values. `.env.local` is private and must never be committed or shared.

Never use a `NEXT_PUBLIC_` prefix for payment secrets, OpenAI keys, webhook secrets, or privileged Supabase keys.

## Final production phase

The following steps require the final domain, approved provider accounts, or production secrets and are intentionally deferred:

- Cashfree live checkout, signed webhooks, refunds, seller-plan renewals, and bank settlement.
- Production domain/deployment and final Supabase/Google redirect URLs.
- Resend domain verification and production transactional email.
- Final legal/contact details, analytics IDs, monitoring, backup verification, and end-to-end live payment tests.
- Optional generative AI can be considered later, but it is not required for the free smart-help chatbot.

Never paste payment-provider secrets, OpenAI keys, passwords, OTPs, or bank details into source code or chat.

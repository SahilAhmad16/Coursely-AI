# Coursely AI — 27 July production checklist

Use this checklist only when the final public domain and approved live provider accounts are ready.

## Owner preparation

- Cashfree merchant KYC approved, settlement bank account verified, and live payment access enabled.
- Final Coursely AI domain purchased and accessible.
- Resend account available. Domain email DNS records can be added after the production domain is connected.
- Final business/legal name, support email, business address, jurisdiction, tax/GST position, and refund contact confirmed.
- Approved affiliate accounts and links available for each partner platform being used.

Do not send passwords, OTPs, complete bank details, identity documents, payment secrets, or private API keys in chat.

## Codex production work

- Deploy the tested production build and attach the final domain.
- Add production Supabase site and redirect URLs.
- Add the production Google OAuth origin while keeping the Supabase callback URL.
- Connect Cashfree live checkout for digital products and professional services.
- Verify Cashfree webhook signatures before marking any payment paid.
- Create orders only from server-verified prices; never trust prices sent by the browser.
- Record the 10% platform commission only for confirmed Digital Product sales.
- Activate ₹50/₹60 seller-plan renewals only after verified payment events.
- Add payment success, failure, retry, refund, invoice, and reconciliation flows.
- Release private digital downloads only after a paid order is verified.
- Connect Resend transactional email after domain verification.
- Add production analytics, monitoring, rate-limit review, and backup verification.
- Replace policy draft placeholders with final reviewed business details.
- Run buyer, seller, admin, affiliate, service, digital-download, refund, and renewal end-to-end tests.

## Final safety gates

- No secret has a `NEXT_PUBLIC_` prefix.
- No affiliate product enters the Coursely AI cart.
- No direct physical inventory, courier, COD, or shipping workflow is enabled.
- Services have no per-sale Coursely AI commission.
- Digital products have a 10% platform commission.
- All seller categories receive one 28-day free trial before paid renewal.
- Expired seller categories remain locked until a verified renewal.
- Google login, email login, password reset, support, policies, and admin access work on the production domain.


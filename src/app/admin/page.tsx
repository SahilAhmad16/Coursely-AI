import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createCoupon, createPromotionalBanner, reviewListing, reviewListingReport, reviewSellerVerification, reviewServiceDispute, reviewSupportTicket, toggleCoupon, togglePromotionalBanner } from "@/app/actions/admin";
import { formatPrice, isSupabaseConfigured } from "@/lib/data/marketplace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PendingProduct = { id: string; title: string; listing_type: string; price_paise: number; stores: { name: string; is_verified: boolean } | { name: string; is_verified: boolean }[] | null };
type LedgerRow = { gross_paise: number; commission_paise: number; seller_net_paise: number; status: "pending" | "earned" | "settled" | "refunded" };
type AuditRow = { id: string; action: string; resource_type: string; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null };
type ListingReportRow = { id: string; reason: string; details: string | null; created_at: string; products: { title: string } | { title: string }[] | null; profiles: { full_name: string } | { full_name: string }[] | null };
type VerificationRow = { id: string; legal_name: string; business_type: string; document_kind: string; document_last4: string; address_line: string; document_path: string; submitted_at: string; profiles: { full_name: string; username: string | null; phone: string | null } | { full_name: string; username: string | null; phone: string | null }[] | null; stores: { name: string; slug: string } | { name: string; slug: string }[] | null };
type SellerStoreRow = { id: string; name: string; slug: string; is_verified: boolean; created_at: string; profiles: { full_name: string; username: string | null; role: string } | { full_name: string; username: string | null; role: string }[] | null };
type ServiceDisputeRow = { id: string; reason: string; details: string; status: "open" | "under_review"; created_at: string; service_projects: { products: { title: string } | { title: string }[] | null } | { products: { title: string } | { title: string }[] | null }[] | null };
type SupportTicketRow = { id: string; category: string; subject: string; message: string; status: "open" | "in_progress"; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null };
type CouponRow = { id: string; code: string; discount_type: "percent" | "fixed"; discount_value: number; minimum_order_paise: number; maximum_uses: number | null; used_count: number; expires_at: string | null; is_active: boolean };
type BannerRow = { id: string; title: string; subtitle: string | null; href: string | null; placement: "home" | "marketplace"; ends_at: string | null; is_active: boolean };
type UserRow = { id: string; full_name: string; username: string | null; role: "buyer" | "seller" | "admin"; created_at: string };
type OrderRow = { id: string; order_number: number; status: string; total_paise: number; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null };
type SubscriptionRow = { id: string; plan_type: "service" | "digital" | "physical"; amount_paise: number; status: string; is_trial: boolean; current_period_end: string | null; stores: { name: string } | { name: string }[] | null };
type PayoutAccountRow = { id: string; seller_id: string; method: "upi" | "bank"; account_holder_name: string; verification_status: "unverified" | "verified" | "rejected"; provider_status: string | null; updated_at: string; profiles: { full_name: string } | { full_name: string }[] | null };
type WithdrawalRow = { id: string; seller_id: string; amount_paise: number; status: "requested" | "processing" | "paid" | "failed" | "rejected" | "cancelled"; provider_status: string | null; provider_status_code: string | null; provider_utr: string | null; provider_payout_id: string | null; requested_at: string; profiles: { full_name: string } | { full_name: string }[] | null };

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

export default async function AdminPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") notFound();

  const [{ data: products }, { data: ledger }, { data: audit }, { data: reports }, { data: verifications }, { data: sellerStores }, { data: disputes }, { data: tickets }, { data: couponRows }, { data: bannerRows }, { data: userRows }, { data: orderRows }, { data: subscriptionRows }, { data: payoutAccountRows }, { data: withdrawalRequestRows }] = await Promise.all([
    supabase.from("products").select("id,title,listing_type,price_paise,stores(name,is_verified)").eq("status", "pending_review").order("created_at", { ascending: true }),
    supabase.from("platform_ledger").select("gross_paise,commission_paise,seller_net_paise,status").order("created_at", { ascending: false }),
    supabase.from("audit_logs").select("id,action,resource_type,created_at,profiles(full_name)").order("created_at", { ascending: false }).limit(12),
    supabase.from("listing_reports").select("id,reason,details,created_at,products(title),profiles!listing_reports_reporter_id_fkey(full_name)").eq("status", "open").order("created_at", { ascending: true }).limit(30),
    supabase.from("seller_verifications").select("id,legal_name,business_type,document_kind,document_last4,address_line,document_path,submitted_at,profiles!seller_verifications_seller_id_fkey(full_name,username,phone),stores(name,slug)").eq("status", "submitted").order("submitted_at", { ascending: true }),
    supabase.from("stores").select("id,name,slug,is_verified,created_at,profiles!stores_owner_id_fkey(full_name,username,role)").order("created_at", { ascending: false }).limit(30),
    supabase.from("service_disputes").select("id,reason,details,status,created_at,service_projects(products(title))").in("status", ["open", "under_review"]).order("created_at", { ascending: true }).limit(30),
    supabase.from("support_tickets").select("id,category,subject,message,status,created_at,profiles!support_tickets_user_id_fkey(full_name)").in("status", ["open", "in_progress"]).order("created_at", { ascending: true }).limit(30),
    supabase.from("coupons").select("id,code,discount_type,discount_value,minimum_order_paise,maximum_uses,used_count,expires_at,is_active").order("created_at", { ascending: false }).limit(30),
    supabase.from("promotional_banners").select("id,title,subtitle,href,placement,ends_at,is_active").order("created_at", { ascending: false }).limit(20),
    supabase.from("profiles").select("id,full_name,username,role,created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("orders").select("id,order_number,status,total_paise,created_at,profiles!orders_buyer_id_fkey(full_name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("platform_subscriptions").select("id,plan_type,amount_paise,status,is_trial,current_period_end,stores(name)").order("created_at", { ascending: false }).limit(30),
    supabase.from("seller_payout_accounts").select("id,seller_id,method,account_holder_name,verification_status,provider_status,updated_at,profiles!seller_payout_accounts_seller_id_fkey(full_name)").order("updated_at", { ascending: false }).limit(30),
    supabase.from("seller_withdrawal_requests").select("id,seller_id,amount_paise,status,provider_status,provider_status_code,provider_utr,provider_payout_id,requested_at,profiles!seller_withdrawal_requests_seller_id_fkey(full_name)").order("requested_at", { ascending: false }).limit(50),
  ]);

  const listings = (products ?? []) as PendingProduct[];
  const ledgerRows = (ledger ?? []) as LedgerRow[];
  const auditRows = (audit ?? []) as AuditRow[];
  const listingReports = (reports ?? []) as ListingReportRow[];
  const verificationRows = (verifications ?? []) as VerificationRow[];
  const stores = (sellerStores ?? []) as SellerStoreRow[];
  const serviceDisputes = (disputes ?? []) as ServiceDisputeRow[];
  const supportTickets = (tickets ?? []) as SupportTicketRow[];
  const coupons = (couponRows ?? []) as CouponRow[];
  const banners = (bannerRows ?? []) as BannerRow[];
  const users = (userRows ?? []) as UserRow[];
  const orders = (orderRows ?? []) as OrderRow[];
  const subscriptions = (subscriptionRows ?? []) as SubscriptionRow[];
  const payoutAccounts = (payoutAccountRows ?? []) as PayoutAccountRow[];
  const withdrawalRequests = (withdrawalRequestRows ?? []) as WithdrawalRow[];
  const documentUrls = new Map(await Promise.all(verificationRows.map(async (verification) => {
    const { data } = await supabase.storage.from("seller-kyc").createSignedUrl(verification.document_path, 60 * 10);
    return [verification.id, data?.signedUrl ?? null] as const;
  })));
  const earnedCommission = ledgerRows.filter((row) => row.status === "earned" || row.status === "settled").reduce((total, row) => total + row.commission_paise, 0);
  const grossVolume = ledgerRows.reduce((total, row) => total + row.gross_paise, 0);
  const sellerNet = ledgerRows.reduce((total, row) => total + row.seller_net_paise, 0);

  return <main className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/dashboard" className="text-sm font-semibold">Seller dashboard</Link></div></header>
    <section className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Marketplace administration</p>
      <h1 className="mt-2 text-4xl font-black">Operations centre</h1>
      <p className="mt-3 text-slate-600">Review sellers, private verification documents, listings, safety reports, disputes, and the platform ledger. {profile.full_name ? `Signed in as ${profile.full_name}.` : ""}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric label="Platform commission earned" value={formatPrice(earnedCommission)} /><Metric label="Paid order volume" value={formatPrice(grossVolume)} /><Metric label="Seller net earnings" value={formatPrice(sellerNet)} /></div>

      <PayoutOperations accounts={payoutAccounts} withdrawals={withdrawalRequests} />

      <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Seller KYC</p><h2 className="mt-1 text-2xl font-black">Verification review queue</h2><p className="mt-1 text-sm text-slate-600">Approve only after checking the private document and seller information.</p></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{verificationRows.length} pending</span></div>
        {verificationRows.length ? <div className="mt-5 space-y-4">{verificationRows.map((verification) => {
          const seller = first(verification.profiles);
          const store = first(verification.stores);
          const documentUrl = documentUrls.get(verification.id);
          return <article key={verification.id} className="rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-bold">{verification.legal_name}</h3><p className="mt-1 text-sm text-slate-600">{store?.name ?? "Seller store"} · {seller?.full_name || "Seller"}{seller?.username ? ` (@${seller.username})` : ""}</p><p className="mt-2 text-sm text-slate-700"><strong>{verification.document_kind.replaceAll("_", " ")}</strong> · ID ending {verification.document_last4} · {verification.business_type.replaceAll("_", " ")}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{verification.address_line}</p><p className="mt-2 text-xs font-medium text-slate-500">Submitted {new Date(verification.submitted_at).toLocaleString("en-IN")}</p></div>{documentUrl ? <a href={documentUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800">Open private document</a> : <span className="text-sm font-semibold text-rose-700">Document link unavailable</span>}</div>
            <form action={reviewSellerVerification} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"><input type="hidden" name="verificationId" value={verification.id} /><textarea name="note" maxLength={1000} className="min-h-11 rounded-xl border border-slate-300 p-3 text-sm" placeholder="Optional admin note (required for a useful changes request)" /><button name="decision" value="changes_requested" className="rounded-xl border border-sky-200 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-50">Request changes</button><button name="decision" value="rejected" className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">Reject</button><button name="decision" value="approved" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Approve</button></form>
          </article>;
        })}</div> : <EmptyState title="No seller verification requests" body="New seller KYC submissions will appear here." />}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Listing review queue</h2><p className="mt-1 text-sm text-slate-600">Only verified sellers can submit listings. Every seller category receives a 28-day free trial.</p></div><span className="rounded-full bg-white px-3 py-2 text-sm font-bold shadow-sm">{listings.length} pending</span></div>
        {listings.length ? <div className="mt-5 space-y-4">{listings.map((listing) => {
          const store = first(listing.stores);
          return <article key={listing.id} className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-white p-6 shadow-sm"><div><h3 className="font-bold">{listing.title}</h3><p className="mt-1 text-sm text-slate-500">{store?.name ?? "Seller store"} · {listing.listing_type} · {formatPrice(listing.price_paise)}</p>{!store?.is_verified && <p className="mt-2 text-xs font-bold text-amber-800">Seller verification required before this listing can be published.</p>}</div><div className="flex gap-3"><form action={reviewListing}><input type="hidden" name="productId" value={listing.id} /><input type="hidden" name="decision" value="rejected" /><button className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-50">Reject</button></form>{store?.is_verified && <form action={reviewListing}><input type="hidden" name="productId" value={listing.id} /><input type="hidden" name="decision" value="published" /><button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">Publish</button></form>}</div></article>;
        })}</div> : <EmptyState title="Review queue is empty" body="Seller submissions will appear here after verification and media upload." />}
      </section>

      <SupportTicketQueue tickets={supportTickets} />
      <MarketingControls coupons={coupons} banners={banners} />
      <OperationsRegistry users={users} orders={orders} subscriptions={subscriptions} />

      <section className="mt-8 rounded-2xl bg-slate-950 p-6 text-white"><h2 className="text-lg font-bold">Commission status</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">For each confirmed Digital Product sale completed on Coursely AI, the ledger keeps 10% as platform commission and records the remainder as seller net earnings. Services have no sale commission. Product Affiliate sales are completed and settled by the external partner. Platform commission and seller subscription payments remain in the owner merchant account; only seller net earnings can be withdrawn through Cashfree Payouts.</p></section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-sky-700">Service safety</p><h2 className="mt-1 text-xl font-black">Open service disputes</h2></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-800">{serviceDisputes.length} open</span></div>{serviceDisputes.length ? <div className="mt-5 space-y-3">{serviceDisputes.map((dispute) => { const project = first(dispute.service_projects); const product = first(project?.products); return <article key={dispute.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold">{product?.title || "Service order"}</p><p className="mt-1 text-sm capitalize text-sky-700">{dispute.reason} · {dispute.status.replaceAll("_", " ")}</p><p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{dispute.details}</p><p className="mt-2 text-xs font-medium text-slate-500">Opened {new Date(dispute.created_at).toLocaleString("en-IN")}</p></div><div className="flex flex-wrap gap-2"><form action={reviewServiceDispute}><input type="hidden" name="disputeId" value={dispute.id} /><button name="decision" value="under_review" className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-bold text-sky-800">Review</button></form><form action={reviewServiceDispute}><input type="hidden" name="disputeId" value={dispute.id} /><button name="decision" value="dismissed" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Dismiss</button></form><form action={reviewServiceDispute}><input type="hidden" name="disputeId" value={dispute.id} /><button name="decision" value="resolved" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Resolve</button></form></div></div></article>; })}</div> : <p className="mt-4 text-sm text-slate-600">There are no open service disputes.</p>}</section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-rose-700">Trust and safety</p><h2 className="mt-1 text-xl font-black">Open listing reports</h2></div><span className="rounded-full bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-700">{listingReports.length} open</span></div>{listingReports.length ? <div className="mt-5 space-y-3">{listingReports.map((report) => { const product = first(report.products); const reporter = first(report.profiles); return <article key={report.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold">{product?.title || "Listing"}</p><p className="mt-1 text-sm capitalize text-rose-700">{report.reason.replaceAll("_", " ")}</p>{report.details && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{report.details}</p>}<p className="mt-2 text-xs font-medium text-slate-500">Reported by {reporter?.full_name || "Customer"} · {new Date(report.created_at).toLocaleString("en-IN")}</p></div><div className="flex gap-2"><form action={reviewListingReport}><input type="hidden" name="reportId" value={report.id} /><input type="hidden" name="decision" value="dismissed" /><button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Dismiss</button></form><form action={reviewListingReport}><input type="hidden" name="reportId" value={report.id} /><input type="hidden" name="decision" value="resolved" /><button className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Resolve</button></form></div></div></article>; })}</div> : <p className="mt-4 text-sm text-slate-600">There are no customer listing reports to review.</p>}</section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-violet-700">Seller registry</p><h2 className="mt-1 text-xl font-black">Stores and verification status</h2></div><span className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-800">{stores.length} recent stores</span></div>{stores.length ? <div className="mt-5 divide-y divide-slate-100">{stores.map((store) => { const seller = first(store.profiles); return <div key={store.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-bold">{store.name}</p><p className="mt-1 text-slate-500">{seller?.full_name || "Seller"}{seller?.username ? ` · @${seller.username}` : ""} · joined {new Date(store.created_at).toLocaleDateString("en-IN")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${store.is_verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{store.is_verified ? "Verified" : "Unverified"}</span></div>; })}</div> : <p className="mt-4 text-sm text-slate-600">Seller stores will appear here once a seller creates a first draft.</p>}</section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Audit trail</p><h2 className="mt-1 text-xl font-black">Recent admin actions</h2></div>{auditRows.length ? <div className="mt-5 divide-y divide-slate-100">{auditRows.map((item) => { const actor = first(item.profiles); return <div key={item.id} className="py-3 text-sm"><p className="font-bold">{item.action.replaceAll("_", " ")}</p><p className="mt-1 text-slate-500">{actor?.full_name || "Administrator"} · {item.resource_type} · {new Date(item.created_at).toLocaleString("en-IN")}</p></div>; })}</div> : <p className="mt-4 text-sm text-slate-600">Admin review actions will be recorded here.</p>}</section>
    </section>
  </main>;
}

function SupportTicketQueue({ tickets }: { tickets: SupportTicketRow[] }) {
  return <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-indigo-700">Customer support</p><h2 className="mt-1 text-xl font-black">Open support tickets</h2></div><span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-800">{tickets.length} open</span></div>{tickets.length ? <div className="mt-5 space-y-4">{tickets.map((ticket) => { const customer = first(ticket.profiles); return <article key={ticket.id} className="rounded-xl border border-slate-200 p-4"><p className="font-bold">{ticket.subject}</p><p className="mt-1 text-xs capitalize text-indigo-700">{ticket.category.replaceAll("_", " ")} · {ticket.status.replaceAll("_", " ")} · {customer?.full_name || "Customer"}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{ticket.message}</p><form action={reviewSupportTicket} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><input type="hidden" name="ticketId" value={ticket.id} /><textarea name="adminNote" maxLength={4000} className="min-h-20 rounded-xl border border-slate-300 p-3 text-sm" placeholder="Response shown privately to the customer" /><button name="decision" value="in_progress" className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-800">Mark reviewing</button><button name="decision" value="resolved" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Resolve</button></form></article>; })}</div> : <p className="mt-4 text-sm text-slate-600">There are no open support tickets.</p>}</section>;
}

function PayoutOperations({ accounts, withdrawals }: { accounts: PayoutAccountRow[]; withdrawals: WithdrawalRow[] }) {
  return <section id="payout-operations" className="mt-8 rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Money operations</p><h2 className="mt-2 text-2xl font-black">Automatic seller payouts</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Cashfree verifies payout destinations and processes seller withdrawals automatically. This panel is read-only monitoring; Coursely AI administrators do not approve or mark transfers manually.</p></div><span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">{withdrawals.filter((item) => item.status === "processing").length} processing</span></div>

    <div className="mt-7 grid gap-6 xl:grid-cols-2">
      <div><h3 className="font-black">Payout accounts</h3><div className="mt-3 space-y-3">{accounts.map((account) => { const seller = first(account.profiles); return <article key={account.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{account.account_holder_name}</p><p className="mt-1 text-sm text-slate-300">{seller?.full_name || "Seller"} · {account.method === "upi" ? "UPI" : "Bank transfer"}</p><p className="mt-2 text-xs text-slate-400">Cashfree: {account.provider_status || "not connected"} · updated {new Date(account.updated_at).toLocaleString("en-IN")}</p></div><PayoutStatus status={account.verification_status} /></div></article>; })}{!accounts.length && <p className="rounded-2xl bg-white/5 p-5 text-sm text-slate-400">No seller payout accounts yet.</p>}</div></div>

      <div><h3 className="font-black">Recent withdrawals</h3><div className="mt-3 space-y-3">{withdrawals.map((withdrawal) => { const seller = first(withdrawal.profiles); return <article key={withdrawal.id} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black">{formatPrice(withdrawal.amount_paise)}</p><p className="mt-1 text-sm text-slate-300">{seller?.full_name || "Seller"}</p><p className="mt-2 text-xs text-slate-400">{withdrawal.provider_status_code || withdrawal.provider_status || "Created"} · {new Date(withdrawal.requested_at).toLocaleString("en-IN")}</p>{withdrawal.provider_utr && <p className="mt-1 text-xs text-slate-400">UTR {withdrawal.provider_utr}</p>}{withdrawal.provider_payout_id && <p className="mt-1 text-xs text-slate-400">Cashfree ref {withdrawal.provider_payout_id}</p>}</div><PayoutStatus status={withdrawal.status} /></div></article>; })}{!withdrawals.length && <p className="rounded-2xl bg-white/5 p-5 text-sm text-slate-400">No seller withdrawals yet.</p>}</div></div>
    </div>
  </section>;
}

function PayoutStatus({ status }: { status: string }) {
  const colors = status === "verified" || status === "paid" ? "bg-emerald-300/15 text-emerald-200" : status === "failed" || status === "rejected" ? "bg-rose-300/15 text-rose-200" : "bg-sky-300/15 text-sky-200";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${colors}`}>{status.replaceAll("_", " ")}</span>;
}

function MarketingControls({ coupons, banners }: { coupons: CouponRow[]; banners: BannerRow[] }) {
  return <section className="mt-8 grid gap-6 lg:grid-cols-2">
    <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm font-bold uppercase tracking-wider text-amber-700">Promotions</p><h2 className="mt-1 text-xl font-black">Coupon controls</h2><p className="mt-2 text-sm leading-6 text-slate-600">Coupons can be prepared now. Applying them to real orders stays disabled until live checkout is connected.</p><form action={createCoupon} className="mt-5 grid gap-3 sm:grid-cols-2"><input name="code" required minLength={3} maxLength={30} placeholder="WELCOME10" className="rounded-xl border border-slate-300 p-3 text-sm uppercase" /><select name="discountType" className="rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="percent">Percent discount</option><option value="fixed">Fixed INR discount</option></select><input name="value" type="number" min="0.01" step="0.01" required placeholder="Value" className="rounded-xl border border-slate-300 p-3 text-sm" /><input name="minimumOrder" type="number" min="0" step="1" placeholder="Minimum order INR" className="rounded-xl border border-slate-300 p-3 text-sm" /><input name="maximumUses" type="number" min="1" step="1" placeholder="Maximum uses (optional)" className="rounded-xl border border-slate-300 p-3 text-sm" /><input name="expiresAt" type="date" className="rounded-xl border border-slate-300 p-3 text-sm" /><button className="w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white sm:col-span-2">Create coupon</button></form><div className="mt-5 space-y-2">{coupons.map((coupon) => <article key={coupon.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-black">{coupon.code}</p><p className="mt-1 text-xs text-slate-500">{coupon.discount_type === "percent" ? `${coupon.discount_value / 100}%` : formatPrice(coupon.discount_value)} · used {coupon.used_count}{coupon.maximum_uses ? `/${coupon.maximum_uses}` : ""}</p></div><form action={toggleCoupon}><input type="hidden" name="couponId" value={coupon.id} /><input type="hidden" name="enabled" value={String(!coupon.is_active)} /><button className={`rounded-full px-3 py-1 text-xs font-bold ${coupon.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{coupon.is_active ? "Active" : "Disabled"}</button></form></article>)}{!coupons.length && <p className="text-sm text-slate-500">No coupons created.</p>}</div></div>
    <div className="rounded-2xl bg-white p-6 shadow-sm"><p className="text-sm font-bold uppercase tracking-wider text-cyan-700">Content</p><h2 className="mt-1 text-xl font-black">Promotional banners</h2><p className="mt-2 text-sm leading-6 text-slate-600">Create controlled announcements for the home or marketplace page. Links must stay inside Coursely AI.</p><form action={createPromotionalBanner} className="mt-5 grid gap-3"><input name="title" required minLength={3} maxLength={100} placeholder="Banner title" className="rounded-xl border border-slate-300 p-3 text-sm" /><textarea name="subtitle" maxLength={240} placeholder="Short supporting text" className="min-h-20 rounded-xl border border-slate-300 p-3 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><input name="href" placeholder="/marketplace?type=digital" className="rounded-xl border border-slate-300 p-3 text-sm" /><select name="placement" className="rounded-xl border border-slate-300 bg-white p-3 text-sm"><option value="home">Home</option><option value="marketplace">Marketplace</option></select><input name="endsAt" type="date" className="rounded-xl border border-slate-300 p-3 text-sm" /></div><button className="w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Create banner</button></form><div className="mt-5 space-y-2">{banners.map((banner) => <article key={banner.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><p className="font-black">{banner.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{banner.placement}{banner.href ? ` · ${banner.href}` : ""}</p></div><form action={togglePromotionalBanner}><input type="hidden" name="bannerId" value={banner.id} /><input type="hidden" name="enabled" value={String(!banner.is_active)} /><button className={`rounded-full px-3 py-1 text-xs font-bold ${banner.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{banner.is_active ? "Active" : "Disabled"}</button></form></article>)}{!banners.length && <p className="text-sm text-slate-500">No banners created.</p>}</div></div>
  </section>;
}

function OperationsRegistry({ users, orders, subscriptions }: { users: UserRow[]; orders: OrderRow[]; subscriptions: SubscriptionRow[] }) {
  return <section className="mt-8 grid gap-6 xl:grid-cols-3">
    <RegistryCard eyebrow="Accounts" title="Recent users" count={users.length}>
      {users.map((user) => <div key={user.id} className="border-t border-slate-100 py-3 text-sm first:border-0">
        <div className="flex items-center justify-between gap-3"><p className="font-bold">{user.full_name || "Unnamed account"}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-700">{user.role}</span></div>
        <p className="mt-1 text-xs text-slate-500">{user.username ? `@${user.username} · ` : ""}Joined {new Date(user.created_at).toLocaleDateString("en-IN")}</p>
      </div>)}
      {!users.length && <RegistryEmpty text="No user accounts yet." />}
    </RegistryCard>

    <RegistryCard eyebrow="Commerce" title="Recent orders" count={orders.length}>
      {orders.map((order) => { const buyer = first(order.profiles); return <div key={order.id} className="border-t border-slate-100 py-3 text-sm first:border-0">
        <div className="flex items-center justify-between gap-3"><p className="font-bold">Order #{order.order_number}</p><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold capitalize text-sky-800">{order.status.replaceAll("_", " ")}</span></div>
        <p className="mt-1 text-xs text-slate-500">{buyer?.full_name || "Buyer"} · {formatPrice(order.total_paise)} · {new Date(order.created_at).toLocaleDateString("en-IN")}</p>
      </div>; })}
      {!orders.length && <RegistryEmpty text="Real orders will appear after live checkout is connected." />}
    </RegistryCard>

    <RegistryCard eyebrow="Seller access" title="Plan subscriptions" count={subscriptions.length}>
      {subscriptions.map((subscription) => { const store = first(subscription.stores); const visiblePlan = subscription.plan_type === "physical" ? "product affiliate" : subscription.plan_type; return <div key={subscription.id} className="border-t border-slate-100 py-3 text-sm first:border-0">
        <div className="flex items-center justify-between gap-3"><p className="font-bold">{store?.name || "Seller store"}</p><span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold capitalize text-violet-800">{subscription.status.replaceAll("_", " ")}</span></div>
        <p className="mt-1 text-xs capitalize text-slate-500">{visiblePlan} · {subscription.is_trial ? "free trial" : formatPrice(subscription.amount_paise)}{subscription.current_period_end ? ` · ends ${new Date(subscription.current_period_end).toLocaleDateString("en-IN")}` : ""}</p>
      </div>; })}
      {!subscriptions.length && <RegistryEmpty text="Seller plans are created with the first listing." />}
    </RegistryCard>
  </section>;
}

function RegistryCard({ eyebrow, title, count, children }: { eyebrow: string; title: string; count: number; children: React.ReactNode }) {
  return <article className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{eyebrow}</p><h2 className="mt-1 text-xl font-black">{title}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{count}</span></div><div className="mt-4 max-h-96 overflow-auto">{children}</div></article>;
}

function RegistryEmpty({ text }: { text: string }) {
  return <p className="py-5 text-sm leading-6 text-slate-500">{text}</p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><h3 className="text-xl font-bold">{title}</h3><p className="mt-2 text-sm text-slate-600">{body}</p></div>;
}

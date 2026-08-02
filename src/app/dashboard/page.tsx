import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { SellerVerificationForm } from "@/components/seller-verification-form";
import { ServiceSellerLocked } from "@/components/service-seller-locked";
import { SellerStoreApplicationForm } from "@/components/seller-store-application-form";
import { SellerWallet } from "@/components/seller-wallet";
import { StoreSettings } from "@/components/store-settings";
import { formatPrice, isSupabaseConfigured } from "@/lib/data/marketplace";
import { getStoreSellerAccess, isSellerPlanActive, planPriceLabel, SELLER_PLANS, type SellerPlanSubscription } from "@/lib/service-seller-plan";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = { id: string; title: string; status: "draft" | "pending_review" | "published" | "archived" | "rejected"; price_paise: number; listing_type: string };
type LedgerRow = { commission_paise: number; seller_net_paise: number; status: "pending" | "earned" | "settled" | "refunded" };
type PayoutAccountRow = { id: string; method: "upi" | "bank"; account_holder_name: string; upi_id: string | null; bank_name: string | null; bank_account_number: string | null; bank_ifsc: string | null; verification_status: "unverified" | "verified" | "rejected"; verification_note: string | null };
type WithdrawalRow = { id: string; amount_paise: number; status: "requested" | "processing" | "paid" | "rejected" | "cancelled" | "failed"; provider_payout_id: string | null; admin_note: string | null; requested_at: string };
type VerificationRow = {
  status: "submitted" | "approved" | "changes_requested" | "rejected";
  legal_name: string;
  business_type: string;
  document_kind: string;
  document_last4: string;
  address_line: string;
  review_note: string | null;
  submitted_at: string;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ wallet?: string }> }) {
  if (!isSupabaseConfigured()) return <SetupState />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: store }, { data: products }, { data: profile }, { data: ledger }, { data: verification }, { data: payoutAccount }, { data: withdrawals }] = await Promise.all([
    supabase.from("stores").select("id,name,slug,description,is_verified,logo_path,banner_path").eq("owner_id", user.id).maybeSingle(),
    supabase.from("products").select("id,title,status,price_paise,listing_type,stores!inner(owner_id)").eq("stores.owner_id", user.id).order("updated_at", { ascending: false }).limit(10),
    supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle(),
    supabase.from("platform_ledger").select("commission_paise,seller_net_paise,status").order("created_at", { ascending: false }),
    supabase.from("seller_verifications").select("status,legal_name,business_type,document_kind,document_last4,address_line,review_note,submitted_at").eq("seller_id", user.id).maybeSingle(),
    supabase.from("seller_payout_accounts").select("id,method,account_holder_name,upi_id,bank_name,bank_account_number,bank_ifsc,verification_status,verification_note").eq("seller_id", user.id).maybeSingle(),
    supabase.from("seller_withdrawal_requests").select("id,amount_paise,status,provider_payout_id,admin_note,requested_at").eq("seller_id", user.id).order("requested_at", { ascending: false }),
  ]);

  const planAccess = store ? await getStoreSellerAccess(supabase, store.id) : { subscriptions: [], lockedPlans: [], isLocked: false };
  if (profile?.role !== "admin" && planAccess.isLocked) return <ServiceSellerLocked subscriptions={planAccess.lockedPlans} />;

  const rows = (products ?? []) as ProductRow[];
  const ledgerRows = (ledger ?? []) as LedgerRow[];
  const verificationRow = (verification ?? null) as VerificationRow | null;
  const canCreateListings = Boolean(store?.is_verified);
  const published = rows.filter((item) => item.status === "published").length;
  const pending = rows.filter((item) => item.status === "pending_review").length;
  const withdrawableLedger = ledgerRows.filter((item) => item.status === "earned" || item.status === "settled");
  const netEarnings = withdrawableLedger.reduce((total, item) => total + item.seller_net_paise, 0);
  const commissionPaid = withdrawableLedger.reduce((total, item) => total + item.commission_paise, 0);
  const withdrawalRows = (withdrawals ?? []) as WithdrawalRow[];
  const reservedPaise = withdrawalRows.filter((item) => item.status === "requested" || item.status === "processing").reduce((total, item) => total + item.amount_paise, 0);
  const paidPaise = withdrawalRows.filter((item) => item.status === "paid").reduce((total, item) => total + item.amount_paise, 0);
  const walletMessage = (await searchParams).wallet;

  return <main className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-black">Coursely AI</Link>
        <div className="flex flex-wrap items-center justify-end gap-4">
          {profile?.role === "admin" && <Link href="/admin" className="text-sm font-semibold text-emerald-700">Admin review</Link>}
          <Link href="/account" className="text-sm font-semibold">Account</Link>
          <Link href="/inbox" className="text-sm font-semibold">Messages</Link>
          <Link href="/marketplace" className="text-sm font-semibold">Marketplace</Link>
          <form action={signOut}><button className="text-sm font-semibold text-slate-600">Log out</button></form>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Seller dashboard</p>
          <h1 className="mt-1 text-4xl font-black">Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1>
          <p className="mt-2 text-sm text-slate-600">{store ? `${store.name}${store.is_verified ? " · verified" : " · complete verification before listing"}` : "Complete the seller application, then submit your verification."}</p>
        </div>
        {canCreateListings && <Link href="/sell" className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5">Add listing</Link>}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Published listings" value={String(published)} />
        <Metric label="Paid sales" value={String(ledgerRows.length)} />
        <Metric label="Your net earnings" value={formatPrice(netEarnings)} />
        <Metric label="Platform commission (10%)" value={formatPrice(commissionPaid)} />
      </div>

      {store && <SellerWallet account={(payoutAccount ?? null) as PayoutAccountRow | null} withdrawals={withdrawalRows} earnedPaise={netEarnings} reservedPaise={reservedPaise} paidPaise={paidPaise} message={walletMessage} />}

      {!store && <SellerStoreApplicationForm />}

      {store && !store.is_verified && <SellerVerificationForm storeId={store.id} verification={verificationRow ? {
        status: verificationRow.status,
        legalName: verificationRow.legal_name,
        businessType: verificationRow.business_type,
        documentKind: verificationRow.document_kind,
        documentLast4: verificationRow.document_last4,
        addressLine: verificationRow.address_line,
        reviewNote: verificationRow.review_note,
        submittedAt: verificationRow.submitted_at,
      } : null} />}

      {store && <StoreSettings store={{ id: store.id, name: store.name, slug: store.slug, description: store.description, logoPath: store.logo_path, bannerPath: store.banner_path }} />}

      {planAccess.subscriptions.length > 0 && <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Seller plans</p>
            <h2 className="mt-1 text-xl font-black">28-day access and renewals</h2>
          </div>
          <Link href="/seller-plan" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Manage plans</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">{planAccess.subscriptions.map((plan) => <PlanCard key={plan.plan_type} plan={plan} />)}</div>
      </section>}

      {canCreateListings && <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold">Your listings</h2>
          <span className="text-sm text-slate-500">{pending ? `${pending} awaiting review` : ""}</span>
        </div>
        {rows.length ? <div className="divide-y divide-slate-100">{rows.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div><p className="font-bold">{item.title}</p><p className="mt-1 text-sm capitalize text-slate-500">{item.listing_type} · {formatPrice(item.price_paise)}</p></div>
          <div className="flex items-center gap-4"><StatusBadge status={item.status} /><Link href={`/dashboard/products/${item.id}`} className="text-sm font-bold text-emerald-700">Manage</Link></div>
        </div>)}</div> : <div className="p-8 text-center">
          <p className="font-semibold">No listings yet.</p>
          <p className="mt-1 text-sm text-slate-600">Create a draft, then add media and submit it for review after your seller verification is approved.</p>
          <Link href="/sell" className="mt-4 inline-block font-bold text-emerald-700">Create your first listing</Link>
        </div>}
      </section>}

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">How money moves</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">For each confirmed Digital Product sale on Coursely AI, 10% is recorded as platform commission and 90% as the seller&apos;s net earnings. Services have no sale commission. Product Affiliate sales and earnings are handled by the external partner. Actual Coursely bank settlements require a connected payment provider and verified bank account.</p>
      </section>
    </div>
  </main>;
}

function PlanCard({ plan }: { plan: SellerPlanSubscription }) {
  const active = isSellerPlanActive(plan);
  return <div className={`rounded-xl border p-4 ${active ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="font-bold">{SELLER_PLANS[plan.plan_type].title}</p><p className="mt-1 text-sm text-slate-600">{plan.is_trial ? "First 28 days free" : planPriceLabel(plan.plan_type)}</p><p className="mt-3 text-sm font-semibold">{active ? `Active until ${new Date(plan.current_period_end!).toLocaleDateString("en-IN")}` : "Renewal payment due"}</p></div>;
}

function SetupState() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Coursely AI setup</p><h1 className="mt-3 text-3xl font-black">Your dashboard is ready to connect.</h1><p className="mt-4 leading-7 text-slate-600">Complete the Supabase connection to activate accounts, listings, private files, seller verification, orders, and payouts.</p><Link href="/marketplace" className="mt-6 inline-block rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">View marketplace</Link></section></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}

function StatusBadge({ status }: { status: ProductRow["status"] }) {
  const style = status === "published" ? "bg-emerald-100 text-emerald-800" : status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${style}`}>{status.replace("_", " ")}</span>;
}

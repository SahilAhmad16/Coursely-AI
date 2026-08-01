import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerPlanPaymentButton } from "@/components/seller-plan-payment-button";
import { isCashfreeConfigured } from "@/lib/cashfree";
import { getCurrentUserSellerAccess, isSellerPlanActive, planPriceLabel, SELLER_PLANS, SERVICE_PLAN_DAYS, type SellerPlanType } from "@/lib/service-seller-plan";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const planOrder: SellerPlanType[] = ["service", "digital", "physical"];

export default async function SellerPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/seller-plan");
  const [access, profileResult] = await Promise.all([
    getCurrentUserSellerAccess(supabase, user.id),
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
  ]);
  const byType = new Map(access.subscriptions.map((plan) => [plan.plan_type, plan]));
  const configured = isCashfreeConfigured();

  return <main className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/marketplace" className="text-sm font-semibold">Marketplace</Link></div></header>
    <section className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Seller plans</p>
      <h1 className="mt-2 text-4xl font-black">Simple pricing, every {SERVICE_PLAN_DAYS} days</h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">Every seller category receives the first {SERVICE_PLAN_DAYS} days free. Only Digital Product sales completed inside Coursely AI record a 10% platform commission.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">{planOrder.map((planType) => {
        const plan = byType.get(planType);
        const active = isSellerPlanActive(plan);
        const commissionNote = planType === "digital" ? "10% commission on confirmed Coursely AI digital sales" : planType === "service" ? "No sale commission on services" : "No Coursely sale commission; partner pays affiliate earnings";
        return <article key={planType} className={`rounded-3xl border p-6 shadow-sm ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">{SELLER_PLANS[planType].title}</p>
          <h2 className="mt-3 text-3xl font-black">₹{SELLER_PLANS[planType].amountPaise / 100}</h2>
          <p className="mt-1 text-sm text-slate-600">First {SERVICE_PLAN_DAYS} days free, then {planPriceLabel(planType)}</p>
          <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">{commissionNote}</p>
          <p className="mt-5 text-sm leading-6 text-slate-600">{plan ? active ? plan.is_trial ? `Free trial active until ${new Date(plan.current_period_end!).toLocaleDateString("en-IN")}.` : `Active until ${new Date(plan.current_period_end!).toLocaleDateString("en-IN")}.` : "Payment required to unlock this seller category." : "This plan is created automatically when you save your first listing in this category."}</p>
          {plan && <SellerPlanPaymentButton planType={planType} defaultPhone={profileResult.data?.phone ?? ""} configured={configured} />}
        </article>;
      })}</div>
      <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm">
        <h2 className="text-xl font-black">Secure Cashfree renewal</h2>
        <p className="mt-3 leading-7 text-slate-600">Each successful payment adds 28 days to the selected category. A plan is activated only after Cashfree is verified by the server. Never send payment, bank, OTP, App ID, or secret-key details through chat.</p>
        {!configured && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Cashfree server credentials still need to be added securely in Vercel. Until then every payment button stays disabled.</p>}
        {!access.isLocked && <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Go to dashboard</Link>}
      </section>
      <p className="mt-5 text-sm leading-6 text-slate-600"><strong>Product affiliate plan:</strong> buyers are sent to the approved partner. Amazon, Flipkart, or another partner handles customer payment, delivery and returns and pays affiliate earnings under its own rules.</p>
    </section>
  </main>;
}

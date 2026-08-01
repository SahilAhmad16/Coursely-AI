import Link from "next/link";
import { redirect } from "next/navigation";
import { ClearPaidCart } from "@/components/clear-paid-cart";
import { fetchCashfreeOrder, fetchCashfreeOrderPayments, isCashfreeConfigured } from "@/lib/cashfree";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/payments/return?order_id=${params.order_id || ""}`)}`);

  let success = false;
  let purpose = "marketplace_order";
  let message = "We are waiting for Cashfree to confirm this payment. Refresh this page in a moment.";
  const providerOrderId = params.order_id;
  if (providerOrderId && isCashfreeConfigured()) {
    const { data: attempt } = await supabase.from("payment_attempts").select("purpose,amount_paise,currency,status").eq("provider_order_id", providerOrderId).maybeSingle();
    if (attempt) {
      purpose = attempt.purpose;
      if (attempt.status === "paid") {
        success = true;
      } else {
        try {
          const cashfreeOrder = await fetchCashfreeOrder(providerOrderId);
          if (cashfreeOrder.order_status === "PAID" && Math.round(cashfreeOrder.order_amount * 100) === attempt.amount_paise && cashfreeOrder.order_currency === attempt.currency.trim()) {
            const payments = await fetchCashfreeOrderPayments(providerOrderId);
            const successfulPayment = payments.find((payment) => payment.payment_status === "SUCCESS");
            if (!successfulPayment) throw new Error("A successful Cashfree payment record was not found.");
            const admin = createAdminClient();
            const { error } = await admin.rpc("settle_cashfree_payment", {
              p_provider_order_id: providerOrderId,
              p_provider_payment_id: String(successfulPayment.cf_payment_id),
              p_amount_paise: attempt.amount_paise,
              p_currency: attempt.currency.trim(),
            });
            if (!error) success = true;
          }
        } catch {
          message = "Cashfree confirmation is temporarily delayed. Your account will update automatically after the signed webhook arrives.";
        }
      }
    } else {
      message = "This payment reference does not belong to your account.";
    }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
    <ClearPaidCart enabled={success && purpose === "marketplace_order"} />
    <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl shadow-slate-900/5">
      <span className={`mx-auto grid size-14 place-items-center rounded-full text-sm font-black ${success ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{success ? "PAID" : "WAIT"}</span>
      <h1 className="mt-5 text-3xl font-black">{success ? "Payment confirmed" : "Payment confirmation pending"}</h1>
      <p className="mt-3 leading-7 text-slate-600">{success ? purpose === "seller_subscription" ? "Your seller plan is active for the next 28 days." : "Your order is now available in your account." : message}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={purpose === "seller_subscription" ? "/seller-plan" : "/account"} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">{purpose === "seller_subscription" ? "View seller plans" : "View my orders"}</Link>
        {!success && <a href={providerOrderId ? `/payments/return?order_id=${encodeURIComponent(providerOrderId)}` : "/account"} className="rounded-xl border border-slate-300 px-5 py-3 font-bold">Check again</a>}
      </div>
    </section>
  </main>;
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { CashfreeError, createCashfreeOrder, getCashfreeMode, isCashfreeConfigured, normalizeIndianPhone } from "@/lib/cashfree";
import { SELLER_PLANS, type SellerPlanType } from "@/lib/service-seller-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const planTypes = new Set<SellerPlanType>(["service", "digital", "physical"]);

export async function POST(request: Request) {
  if (!isCashfreeConfigured()) return NextResponse.json({ error: "Secure online payments are being configured." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const body = await request.json().catch(() => null) as { planType?: SellerPlanType; phone?: string } | null;
  const phone = normalizeIndianPhone(body?.phone ?? "");
  if (!body?.planType || !planTypes.has(body.planType) || !phone) {
    return NextResponse.json({ error: "Select a valid plan and enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase.from("payment_attempts").select("id", { count: "exact", head: true }).gte("created_at", oneMinuteAgo);
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "Please wait a minute before trying again." }, { status: 429 });

  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "Create your seller store first." }, { status: 400 });
  const { data: subscription } = await supabase.from("platform_subscriptions").select("id,amount_paise").eq("store_id", store.id).eq("plan_type", body.planType).maybeSingle();
  if (!subscription) return NextResponse.json({ error: "Create a listing in this category before buying its plan." }, { status: 400 });

  const expectedAmount = SELLER_PLANS[body.planType].amountPaise;
  if (subscription.amount_paise !== expectedAmount) return NextResponse.json({ error: "The plan price could not be verified." }, { status: 409 });

  const admin = createAdminClient();
  const attemptId = randomUUID();
  const providerOrderId = `ca_s_${attemptId.replaceAll("-", "")}`;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const { error: attemptError } = await admin.from("payment_attempts").insert({
    id: attemptId,
    provider_order_id: providerOrderId,
    purpose: "seller_subscription",
    buyer_id: user.id,
    subscription_id: subscription.id,
    amount_paise: expectedAmount,
    currency: "INR",
  });
  if (attemptError) return NextResponse.json({ error: "Payment setup failed safely. No amount was charged." }, { status: 500 });

  try {
    const cashfreeOrder = await createCashfreeOrder({
      providerOrderId,
      amountPaise: expectedAmount,
      customerId: user.id,
      customerName: profile?.full_name || "Coursely seller",
      customerEmail: user.email,
      customerPhone: phone,
      returnUrl: `${siteUrl}/payments/return?order_id=${encodeURIComponent(providerOrderId)}`,
      notifyUrl: `${siteUrl}/api/webhooks/cashfree`,
      note: `Coursely AI ${body.planType} seller plan - 28 days`,
    });
    await admin.from("payment_attempts").update({ provider_cf_order_id: cashfreeOrder.cf_order_id }).eq("id", attemptId);
    return NextResponse.json({ paymentSessionId: cashfreeOrder.payment_session_id, mode: getCashfreeMode() });
  } catch (caught) {
    const message = caught instanceof CashfreeError ? caught.message : "Cashfree is temporarily unavailable.";
    await admin.from("payment_attempts").update({ status: "failed", failure_reason: message.slice(0, 500) }).eq("id", attemptId);
    return NextResponse.json({ error: `${message} No amount was charged.` }, { status: caught instanceof CashfreeError ? Math.max(400, caught.status) : 502 });
  }
}

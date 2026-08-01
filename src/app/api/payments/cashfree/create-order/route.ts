import { NextResponse } from "next/server";
import { CashfreeError, createCashfreeOrder, getCashfreeMode, isCashfreeConfigured, normalizeIndianPhone } from "@/lib/cashfree";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CartInput = { id?: unknown; quantity?: unknown };

export async function POST(request: Request) {
  if (!isCashfreeConfigured()) {
    return NextResponse.json({ error: "Secure online payments are being configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Please log in before checkout." }, { status: 401 });

  const body = await request.json().catch(() => null) as { items?: CartInput[]; phone?: string } | null;
  const phone = normalizeIndianPhone(body?.phone ?? "");
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 25) {
    return NextResponse.json({ error: "Your cart is empty or invalid." }, { status: 400 });
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase.from("payment_attempts").select("id", { count: "exact", head: true }).gte("created_at", oneMinuteAgo);
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "Please wait a minute before trying again." }, { status: 429 });

  const items = body.items.map((item) => ({ product_id: item.id, quantity: item.quantity }));
  const { data, error } = await supabase.rpc("create_checkout_order", { p_items: items });
  const order = Array.isArray(data) ? data[0] : null;
  if (error || !order) return NextResponse.json({ error: error?.message || "The order could not be created." }, { status: 400 });

  const admin = createAdminClient();
  const providerOrderId = `ca_o_${String(order.order_id).replaceAll("-", "")}`;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const { error: attemptError } = await admin.from("payment_attempts").insert({
    provider_order_id: providerOrderId,
    purpose: "marketplace_order",
    buyer_id: user.id,
    order_id: order.order_id,
    amount_paise: order.total_paise,
    currency: "INR",
  });
  if (attemptError) return NextResponse.json({ error: "Payment setup failed safely. No amount was charged." }, { status: 500 });

  try {
    const cashfreeOrder = await createCashfreeOrder({
      providerOrderId,
      amountPaise: Number(order.total_paise),
      customerId: user.id,
      customerName: profile?.full_name || "Coursely customer",
      customerEmail: user.email,
      customerPhone: phone,
      returnUrl: `${siteUrl}/payments/return?order_id=${encodeURIComponent(providerOrderId)}`,
      notifyUrl: `${siteUrl}/api/webhooks/cashfree`,
      note: `Coursely AI order ${order.order_number}`,
    });
    await admin.from("payment_attempts").update({ provider_cf_order_id: cashfreeOrder.cf_order_id }).eq("provider_order_id", providerOrderId);
    return NextResponse.json({ paymentSessionId: cashfreeOrder.payment_session_id, mode: getCashfreeMode() });
  } catch (caught) {
    const message = caught instanceof CashfreeError ? caught.message : "Cashfree is temporarily unavailable.";
    await admin.from("payment_attempts").update({ status: "failed", failure_reason: message.slice(0, 500) }).eq("provider_order_id", providerOrderId);
    return NextResponse.json({ error: `${message} No amount was charged.` }, { status: caught instanceof CashfreeError ? Math.max(400, caught.status) : 502 });
  }
}

import { NextResponse } from "next/server";
import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { createAdminClient } from "@/lib/supabase/admin";

type CashfreeWebhook = {
  type?: string;
  data?: {
    order?: { order_id?: string; order_amount?: number | string; order_currency?: string };
    payment?: { cf_payment_id?: string | number; payment_status?: string };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: CashfreeWebhook;
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const eventType = payload.type || "UNKNOWN";
  const providerOrderId = payload.data?.order?.order_id;
  const headerKey = request.headers.get("x-idempotency-key");
  const paymentId = String(payload.data?.payment?.cf_payment_id ?? "unknown");
  const idempotencyKey = headerKey || `${eventType}:${providerOrderId || "unknown"}:${paymentId}`;
  const admin = createAdminClient();

  const { error: eventError } = await admin.from("payment_webhook_events").insert({
    idempotency_key: idempotencyKey,
    provider_order_id: providerOrderId ?? null,
    event_type: eventType,
    payload,
  });
  if (eventError?.code === "23505") return NextResponse.json({ received: true });
  if (eventError) return NextResponse.json({ error: "Webhook could not be recorded." }, { status: 500 });

  try {
    if (!providerOrderId) throw new Error("Cashfree order ID is missing.");
    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" && payload.data?.payment?.payment_status === "SUCCESS") {
      const amount = Number(payload.data.order?.order_amount);
      const currency = payload.data.order?.order_currency;
      if (!Number.isFinite(amount) || !currency) throw new Error("Cashfree amount or currency is missing.");
      const { error } = await admin.rpc("settle_cashfree_payment", {
        p_provider_order_id: providerOrderId,
        p_provider_payment_id: paymentId,
        p_amount_paise: Math.round(amount * 100),
        p_currency: currency,
      });
      if (error) throw error;
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
      await admin.from("payment_attempts").update({
        status: "failed",
        failure_reason: eventType === "PAYMENT_USER_DROPPED_WEBHOOK" ? "Customer left the payment page." : "Cashfree reported a failed payment.",
      }).eq("provider_order_id", providerOrderId).eq("status", "pending");
    }

    await admin.from("payment_webhook_events").update({ processed: true, processed_at: new Date().toISOString() }).eq("idempotency_key", idempotencyKey);
    return NextResponse.json({ received: true });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Webhook processing failed.";
    await admin.from("payment_webhook_events").update({ processing_error: message.slice(0, 1000) }).eq("idempotency_key", idempotencyKey);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

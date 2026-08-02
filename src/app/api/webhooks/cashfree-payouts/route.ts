import { NextResponse } from "next/server";
import { transferState, verifyCashfreePayoutWebhook } from "@/lib/cashfree-payouts";
import { createAdminClient } from "@/lib/supabase/admin";

type PayoutWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    transfer_id?: string;
    cf_transfer_id?: string;
    status?: string;
    status_code?: string;
    status_description?: string;
    transfer_utr?: string;
  };
};

const TRANSFER_EVENTS = new Set([
  "TRANSFER_ACKNOWLEDGED",
  "TRANSFER_SUCCESS",
  "TRANSFER_FAILED",
  "TRANSFER_REVERSED",
  "TRANSFER_REJECTED",
]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  if (!verifyCashfreePayoutWebhook(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: PayoutWebhook;
  try {
    payload = JSON.parse(rawBody) as PayoutWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = payload.type || "UNKNOWN";
  if (!TRANSFER_EVENTS.has(eventType)) return NextResponse.json({ received: true });
  const transfer = payload.data;
  if (!transfer?.transfer_id || !transfer.status) {
    return NextResponse.json({ error: "Transfer details are missing." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: withdrawal, error: readError } = await admin.from("seller_withdrawal_requests")
    .select("id,seller_id,status")
    .eq("provider_transfer_id", transfer.transfer_id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "Withdrawal lookup failed." }, { status: 500 });
  if (!withdrawal) return NextResponse.json({ received: true });

  const nextStatus = transferState({ status: transfer.status, status_code: transfer.status_code });
  if ((withdrawal.status === "paid" || withdrawal.status === "failed") && nextStatus === "processing") {
    return NextResponse.json({ received: true });
  }
  const terminal = nextStatus === "paid" || nextStatus === "failed";
  const { error: updateError } = await admin.from("seller_withdrawal_requests").update({
    status: nextStatus,
    provider_payout_id: transfer.cf_transfer_id || null,
    provider_status: transfer.status,
    provider_status_code: transfer.status_code || null,
    provider_utr: transfer.transfer_utr || null,
    provider_response: payload,
    admin_note: transfer.status_description || null,
    processed_at: terminal ? new Date().toISOString() : null,
  }).eq("id", withdrawal.id);
  if (updateError) return NextResponse.json({ error: "Withdrawal update failed." }, { status: 500 });

  if (withdrawal.status !== nextStatus && terminal) {
    await admin.from("notifications").insert({
      user_id: withdrawal.seller_id,
      kind: "account",
      title: nextStatus === "paid" ? "Withdrawal paid" : "Withdrawal failed",
      body: nextStatus === "paid"
        ? `Your automatic payout is complete${transfer.transfer_utr ? ` (UTR ${transfer.transfer_utr})` : ""}.`
        : `${transfer.status_description || "Cashfree could not complete the transfer."} Your balance is available to withdraw again.`,
      href: "/dashboard#seller-wallet",
    });
    await admin.from("audit_logs").insert({
      actor_id: null,
      action: `cashfree_payout_${nextStatus}`,
      resource_type: "seller_withdrawal",
      resource_id: withdrawal.id,
      details: { event_type: eventType, transfer_id: transfer.transfer_id, cf_transfer_id: transfer.cf_transfer_id || null },
    });
  }

  return NextResponse.json({ received: true });
}

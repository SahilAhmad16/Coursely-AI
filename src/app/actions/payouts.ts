"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

export async function savePayoutAccount(formData: FormData) {
  const method = field(formData, "method");
  const accountHolderName = field(formData, "accountHolderName");
  const upiId = field(formData, "upiId").toLowerCase();
  const bankName = field(formData, "bankName");
  const bankAccountNumber = field(formData, "bankAccountNumber");
  const bankIfsc = field(formData, "bankIfsc").toUpperCase();
  const validUpi = /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/.test(upiId);
  const validBank = /^[0-9]{6,24}$/.test(bankAccountNumber) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc) && bankName.length >= 2;

  if (!['upi', 'bank'].includes(method) || accountHolderName.length < 2 || accountHolderName.length > 100 || (method === "upi" ? !validUpi : !validBank)) {
    redirect("/dashboard?wallet=invalid-account#seller-wallet");
  }

  const { supabase, user } = await requireUser();
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/dashboard?wallet=seller-required#seller-wallet");

  const admin = createAdminClient();
  const { error } = await admin.from("seller_payout_accounts").upsert({
    seller_id: user.id,
    method,
    account_holder_name: accountHolderName,
    upi_id: method === "upi" ? upiId : null,
    bank_name: method === "bank" ? bankName : null,
    bank_account_number: method === "bank" ? bankAccountNumber : null,
    bank_ifsc: method === "bank" ? bankIfsc : null,
    verification_status: "unverified",
    verification_note: null,
    verified_at: null,
    verified_by: null,
  }, { onConflict: "seller_id" });

  if (error) redirect("/dashboard?wallet=save-failed#seller-wallet");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect("/dashboard?wallet=account-saved#seller-wallet");
}

export async function requestWithdrawal(formData: FormData) {
  const rawAmount = field(formData, "amountRupees");
  const amountRupees = Number(rawAmount);
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount) || !Number.isFinite(amountRupees) || amountRupees < 100) {
    redirect("/dashboard?wallet=invalid-amount#seller-wallet");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("request_seller_withdrawal", { p_amount_paise: Math.round(amountRupees * 100) });
  if (error) {
    const reason = error.message.includes("verified payout") ? "verify-required" : error.message.includes("available balance") ? "insufficient-balance" : "request-failed";
    redirect(`/dashboard?wallet=${reason}#seller-wallet`);
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect("/dashboard?wallet=requested#seller-wallet");
}

export async function cancelWithdrawal(formData: FormData) {
  const requestId = field(formData, "requestId");
  if (!isUuid(requestId)) redirect("/dashboard#seller-wallet");
  const { supabase } = await requireUser();
  await supabase.rpc("cancel_seller_withdrawal", { p_request_id: requestId });
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect("/dashboard?wallet=cancelled#seller-wallet");
}

export async function reviewPayoutAccount(formData: FormData) {
  const payoutAccountId = field(formData, "payoutAccountId");
  const decision = field(formData, "decision");
  const note = field(formData, "note");
  if (!isUuid(payoutAccountId) || !["verified", "rejected"].includes(decision) || note.length > 1000) redirect("/admin");

  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const { data: account } = await admin.from("seller_payout_accounts").select("id,seller_id").eq("id", payoutAccountId).maybeSingle();
  if (!account) redirect("/admin");

  const { error } = await admin.from("seller_payout_accounts").update({
    verification_status: decision,
    verification_note: note || (decision === "verified" ? "Payout destination verified." : "Payout destination could not be verified."),
    verified_at: decision === "verified" ? new Date().toISOString() : null,
    verified_by: user.id,
  }).eq("id", payoutAccountId);

  if (!error) {
    await admin.from("notifications").insert({
      user_id: account.seller_id,
      kind: "account",
      title: decision === "verified" ? "Payout account verified" : "Payout account needs attention",
      body: note || (decision === "verified" ? "You can now request withdrawals from your available balance." : "Please update your payout information and submit it again."),
      href: "/dashboard#seller-wallet",
    });
    await admin.from("audit_logs").insert({ actor_id: user.id, action: `payout_account_${decision}`, resource_type: "seller_payout_account", resource_id: payoutAccountId, details: { seller_id: account.seller_id } });
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin#payout-operations");
}

export async function reviewWithdrawal(formData: FormData) {
  const withdrawalId = field(formData, "withdrawalId");
  const decision = field(formData, "decision");
  const reference = field(formData, "reference");
  const note = field(formData, "note");
  if (!isUuid(withdrawalId) || !["processing", "paid", "rejected", "failed"].includes(decision) || note.length > 1000 || reference.length > 200 || (decision === "paid" && reference.length < 3)) redirect("/admin");

  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const { data: request } = await admin.from("seller_withdrawal_requests").select("id,seller_id,status,amount_paise").eq("id", withdrawalId).maybeSingle();
  if (!request || !["requested", "processing"].includes(request.status) || (request.status === "processing" && decision === "rejected")) redirect("/admin");

  const finished = ["paid", "rejected", "failed"].includes(decision);
  const { error } = await admin.from("seller_withdrawal_requests").update({
    status: decision,
    payout_provider: "manual",
    provider_payout_id: reference || null,
    admin_note: note || null,
    processed_at: finished ? new Date().toISOString() : null,
    processed_by: user.id,
  }).eq("id", withdrawalId).in("status", ["requested", "processing"]);

  if (!error) {
    const title = decision === "paid" ? "Withdrawal paid" : decision === "processing" ? "Withdrawal processing" : decision === "rejected" ? "Withdrawal rejected" : "Withdrawal transfer failed";
    await admin.from("notifications").insert({ user_id: request.seller_id, kind: "account", title, body: note || `Your withdrawal status is now ${decision}.`, href: "/dashboard#seller-wallet" });
    await admin.from("audit_logs").insert({ actor_id: user.id, action: `withdrawal_${decision}`, resource_type: "seller_withdrawal", resource_id: withdrawalId, details: { seller_id: request.seller_id, amount_paise: request.amount_paise, reference: reference || null } });
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin#payout-operations");
}

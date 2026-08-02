"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CashfreePayoutError,
  createCashfreeBeneficiary,
  createCashfreeTransfer,
  isCashfreePayoutsConfigured,
  makeBeneficiaryId,
  transferState,
} from "@/lib/cashfree-payouts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function savePayoutAccount(formData: FormData) {
  const method = field(formData, "method") as "upi" | "bank";
  const accountHolderName = field(formData, "accountHolderName");
  const upiId = field(formData, "upiId").toLowerCase();
  const bankName = field(formData, "bankName");
  const bankAccountNumber = field(formData, "bankAccountNumber");
  const bankIfsc = field(formData, "bankIfsc").toUpperCase();
  const validUpi = /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/.test(upiId);
  const validBank = /^[0-9]{6,24}$/.test(bankAccountNumber) && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc) && bankName.length >= 2;

  if (!["upi", "bank"].includes(method) || accountHolderName.length < 2 || accountHolderName.length > 100 || (method === "upi" ? !validUpi : !validBank)) {
    redirect("/dashboard?wallet=invalid-account#seller-wallet");
  }
  if (!isCashfreePayoutsConfigured()) redirect("/dashboard?wallet=payouts-not-configured#seller-wallet");

  const { supabase, user } = await requireUser();
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (!store) redirect("/dashboard?wallet=seller-required#seller-wallet");

  const fingerprint = method === "upi" ? `upi:${upiId}` : `bank:${bankAccountNumber}:${bankIfsc}`;
  const beneficiaryId = makeBeneficiaryId(user.id, fingerprint);
  let beneficiary;
  try {
    beneficiary = await createCashfreeBeneficiary({
      beneficiaryId,
      beneficiaryName: accountHolderName,
      method,
      upiId: method === "upi" ? upiId : undefined,
      bankAccountNumber: method === "bank" ? bankAccountNumber : undefined,
      bankIfsc: method === "bank" ? bankIfsc : undefined,
    });
  } catch {
    redirect("/dashboard?wallet=beneficiary-failed#seller-wallet");
  }

  const providerStatus = beneficiary.beneficiary_status;
  const verificationStatus = providerStatus === "VERIFIED" ? "verified" : providerStatus === "INITIATED" ? "unverified" : "rejected";
  const admin = createAdminClient();
  const { error } = await admin.from("seller_payout_accounts").upsert({
    seller_id: user.id,
    method,
    account_holder_name: accountHolderName,
    upi_id: method === "upi" ? upiId : null,
    bank_name: method === "bank" ? bankName : null,
    bank_account_number: method === "bank" ? bankAccountNumber : null,
    bank_ifsc: method === "bank" ? bankIfsc : null,
    verification_status: verificationStatus,
    verification_note: verificationStatus === "verified" ? "Verified automatically by Cashfree Payouts." : `Cashfree beneficiary status: ${providerStatus}.`,
    verified_at: verificationStatus === "verified" ? new Date().toISOString() : null,
    verified_by: null,
    provider_beneficiary_id: beneficiaryId,
    provider_status: providerStatus,
    provider_response: beneficiary,
  }, { onConflict: "seller_id" });

  if (error) redirect("/dashboard?wallet=save-failed#seller-wallet");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect(`/dashboard?wallet=${verificationStatus === "verified" ? "account-verified" : "verification-pending"}#seller-wallet`);
}

export async function requestWithdrawal(formData: FormData) {
  const rawAmount = field(formData, "amountRupees");
  const amountRupees = Number(rawAmount);
  if (!/^\d+(\.\d{1,2})?$/.test(rawAmount) || !Number.isFinite(amountRupees) || amountRupees < 100) {
    redirect("/dashboard?wallet=invalid-amount#seller-wallet");
  }
  if (!isCashfreePayoutsConfigured()) redirect("/dashboard?wallet=payouts-not-configured#seller-wallet");

  const { supabase, user } = await requireUser();
  const amountPaise = Math.round(amountRupees * 100);
  const { data: requestId, error } = await supabase.rpc("request_seller_withdrawal", { p_amount_paise: amountPaise });
  if (error || typeof requestId !== "string") {
    const reason = error?.message.includes("verified payout") ? "verify-required" : error?.message.includes("available balance") ? "insufficient-balance" : "request-failed";
    redirect(`/dashboard?wallet=${reason}#seller-wallet`);
  }

  const admin = createAdminClient();
  const { data: withdrawal } = await admin.from("seller_withdrawal_requests")
    .select("id,amount_paise,provider_transfer_id,seller_payout_accounts!inner(method,provider_beneficiary_id)")
    .eq("id", requestId).eq("seller_id", user.id).single();
  const destination = Array.isArray(withdrawal?.seller_payout_accounts) ? withdrawal.seller_payout_accounts[0] : withdrawal?.seller_payout_accounts;
  if (!withdrawal?.provider_transfer_id || !destination?.provider_beneficiary_id) {
    await failWithdrawal(admin, requestId, user.id, "Payout destination is unavailable.", "DESTINATION_MISSING");
    redirect("/dashboard?wallet=transfer-failed#seller-wallet");
  }

  let resultMessage = "processing";
  try {
    const transfer = await createCashfreeTransfer({
      transferId: withdrawal.provider_transfer_id,
      beneficiaryId: destination.provider_beneficiary_id,
      amountPaise: withdrawal.amount_paise,
      method: destination.method,
    });
    const status = transferState(transfer);
    await admin.from("seller_withdrawal_requests").update({
      status,
      provider_payout_id: transfer.cf_transfer_id || null,
      provider_status: transfer.status,
      provider_status_code: transfer.status_code || null,
      provider_utr: transfer.transfer_utr || null,
      provider_response: transfer,
      admin_note: transfer.status_description || null,
      processed_at: status === "paid" || status === "failed" ? new Date().toISOString() : null,
    }).eq("id", requestId).eq("seller_id", user.id);
    resultMessage = status === "paid" ? "paid" : status === "failed" ? "transfer-failed" : "processing";
  } catch (caught) {
    if (caught instanceof CashfreePayoutError && caught.status < 500) {
      await failWithdrawal(admin, requestId, user.id, caught.message, caught.code || "PAYOUT_REJECTED");
      resultMessage = "transfer-failed";
    } else {
      await admin.from("seller_withdrawal_requests").update({
        provider_status: "UNKNOWN",
        provider_status_code: "STATUS_CHECK_REQUIRED",
        admin_note: "Cashfree did not return a final response. The transfer remains reserved while its status is reconciled.",
      }).eq("id", requestId).eq("seller_id", user.id);
    }
  }
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirect(`/dashboard?wallet=${resultMessage}#seller-wallet`);
}

async function failWithdrawal(admin: ReturnType<typeof createAdminClient>, requestId: string, sellerId: string, message: string, code: string) {
  await admin.from("seller_withdrawal_requests").update({
    status: "failed",
    provider_status: "FAILED",
    provider_status_code: code.slice(0, 120),
    admin_note: message.slice(0, 1000),
    processed_at: new Date().toISOString(),
  }).eq("id", requestId).eq("seller_id", sellerId).in("status", ["requested", "processing"]);
  await admin.from("notifications").insert({
    user_id: sellerId,
    kind: "account",
    title: "Withdrawal failed",
    body: `${message.slice(0, 300)} Your balance is available to withdraw again.`,
    href: "/dashboard#seller-wallet",
  });
}

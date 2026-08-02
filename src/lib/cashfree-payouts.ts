import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type CashfreeBeneficiary = {
  beneficiary_id: string;
  beneficiary_status: "VERIFIED" | "INVALID" | "INITIATED" | "CANCELLED" | "FAILED" | "DELETED";
  [key: string]: unknown;
};

export type CashfreeTransfer = {
  transfer_id: string;
  cf_transfer_id?: string;
  status: string;
  status_code?: string;
  status_description?: string;
  transfer_utr?: string;
  [key: string]: unknown;
};

export class CashfreePayoutError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
  }
}

export function isCashfreePayoutsConfigured() {
  return Boolean(process.env.CASHFREE_PAYOUT_CLIENT_ID && process.env.CASHFREE_PAYOUT_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function baseUrl() {
  const production = (process.env.CASHFREE_PAYOUT_ENVIRONMENT || process.env.CASHFREE_ENVIRONMENT) === "production";
  return production ? "https://api.cashfree.com/payout" : "https://sandbox.cashfree.com/payout";
}

async function payoutRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const clientId = process.env.CASHFREE_PAYOUT_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_PAYOUT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new CashfreePayoutError("Cashfree Payouts is not configured.", 503, "not_configured");

  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-version": "2024-01-01",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-request-id": randomUUID(),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new CashfreePayoutError(
      typeof payload.message === "string" ? payload.message : "Cashfree could not process the payout request.",
      response.status,
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }
  return payload as T;
}

export function makeBeneficiaryId(sellerId: string, destinationFingerprint: string) {
  const digest = createHash("sha256").update(destinationFingerprint).digest("hex").slice(0, 10);
  return `seller_${sellerId.replaceAll("-", "")}_${digest}`.slice(0, 50);
}

export function makeBeneficiaryName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim();
  return (normalized || "Coursely Seller").slice(0, 100);
}

export async function createCashfreeBeneficiary(input: {
  beneficiaryId: string;
  beneficiaryName: string;
  method: "upi" | "bank";
  upiId?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
}) {
  try {
    return await payoutRequest<CashfreeBeneficiary>("/beneficiary", {
      method: "POST",
      body: JSON.stringify({
        beneficiary_id: input.beneficiaryId,
        beneficiary_name: makeBeneficiaryName(input.beneficiaryName),
        beneficiary_instrument_details: input.method === "upi"
          ? { vpa: input.upiId }
          : { bank_account_number: input.bankAccountNumber, bank_ifsc: input.bankIfsc },
      }),
    });
  } catch (error) {
    if (error instanceof CashfreePayoutError && error.status === 409 && error.code === "beneficiary_id_already_exists") {
      return payoutRequest<CashfreeBeneficiary>(`/beneficiary?beneficiary_id=${encodeURIComponent(input.beneficiaryId)}`);
    }
    if (error instanceof CashfreePayoutError && error.status === 409 && error.code === "beneficiary_already_exists" && input.method === "bank") {
      return payoutRequest<CashfreeBeneficiary>(`/beneficiary?bank_account_number=${encodeURIComponent(input.bankAccountNumber || "")}&bank_ifsc=${encodeURIComponent(input.bankIfsc || "")}`);
    }
    throw error;
  }
}

export function createCashfreeTransfer(input: { transferId: string; beneficiaryId: string; amountPaise: number; method: "upi" | "bank" }) {
  return payoutRequest<CashfreeTransfer>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      transfer_id: input.transferId,
      transfer_amount: Number((input.amountPaise / 100).toFixed(2)),
      transfer_currency: "INR",
      transfer_mode: input.method === "upi" ? "upi" : "banktransfer",
      beneficiary_details: { beneficiary_id: input.beneficiaryId },
    }),
  });
}

export function verifyCashfreePayoutWebhook(rawBody: string, timestamp: string | null, signature: string | null) {
  const secret = process.env.CASHFREE_PAYOUT_WEBHOOK_SECRET || process.env.CASHFREE_PAYOUT_CLIENT_SECRET;
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function transferState(transfer: Pick<CashfreeTransfer, "status" | "status_code">) {
  const status = transfer.status?.toUpperCase();
  const code = transfer.status_code?.toUpperCase();
  if (status === "SUCCESS" && code === "COMPLETED") return "paid" as const;
  if (["FAILED", "REJECTED", "REVERSED"].includes(status)) return "failed" as const;
  return "processing" as const;
}

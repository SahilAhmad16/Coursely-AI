import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type CashfreeMode = "sandbox" | "production";
export type CashfreeOrder = {
  cf_order_id: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";
  payment_session_id: string;
};

export type CashfreePayment = {
  cf_payment_id: string | number;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED" | "VOID" | "CANCELLED";
};

export class CashfreeError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
  }
}

export function getCashfreeMode(): CashfreeMode {
  return process.env.CASHFREE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function isCashfreeConfigured() {
  return Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function cashfreeBaseUrl() {
  return getCashfreeMode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

async function cashfreeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new CashfreeError("Cashfree is not configured.", 503, "not_configured");

  const response = await fetch(`${cashfreeBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-version": "2025-01-01",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new CashfreeError(
      typeof payload.message === "string" ? payload.message : "Cashfree could not process the request.",
      response.status,
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }
  return payload as T;
}

export function createCashfreeOrder(input: {
  providerOrderId: string;
  amountPaise: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
  note: string;
}) {
  return cashfreeRequest<CashfreeOrder>("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": randomUUID() },
    body: JSON.stringify({
      order_id: input.providerOrderId,
      order_amount: Number((input.amountPaise / 100).toFixed(2)),
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId.replaceAll("-", "").slice(0, 40),
        customer_name: input.customerName.slice(0, 100),
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
      },
      order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
      order_note: input.note.slice(0, 200),
    }),
  });
}

export function fetchCashfreeOrder(providerOrderId: string) {
  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(providerOrderId)}`);
}

export function fetchCashfreeOrderPayments(providerOrderId: string) {
  return cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(providerOrderId)}/payments`);
}

export function verifyCashfreeWebhook(rawBody: string, timestamp: string | null, signature: string | null) {
  const secret = process.env.CASHFREE_CLIENT_SECRET;
  if (!secret || !timestamp || !signature) return false;
  if (!/^\d{10,16}$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

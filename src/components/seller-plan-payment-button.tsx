"use client";

import { useState } from "react";
import { openCashfreeCheckout } from "@/lib/cashfree-browser";
import type { SellerPlanType } from "@/lib/service-seller-plan";

export function SellerPlanPaymentButton({ planType, defaultPhone, configured }: { planType: SellerPlanType; defaultPhone: string; configured: boolean }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/cashfree/create-subscription-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planType, phone }),
      });
      const result = await response.json() as { error?: string; paymentSessionId?: string; mode?: "sandbox" | "production" };
      if (!response.ok || !result.paymentSessionId || !result.mode) throw new Error(result.error || "Payment could not be started.");
      await openCashfreeCheckout(result.paymentSessionId, result.mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be started.");
      setLoading(false);
    }
  }

  return <div className="mt-5 space-y-3">
    <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={14} placeholder="10-digit mobile number" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950" />
    <button type="button" disabled={!configured || loading} onClick={pay} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Opening secure checkout..." : configured ? "Pay securely with Cashfree" : "Cashfree setup pending"}</button>
    {error && <p className="text-xs font-semibold leading-5 text-rose-700">{error}</p>}
  </div>;
}

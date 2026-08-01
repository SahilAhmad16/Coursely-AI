"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import { openCashfreeCheckout } from "@/lib/cashfree-browser";

export function CheckoutView({ defaultPhone, configured }: { defaultPhone: string; configured: boolean }) {
  const { items, totalPaise } = useCart();
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const total = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(totalPaise / 100);

  async function pay() {
    if (!items.length) return setError("Your cart is empty.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/cashfree/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: items.map((item) => ({ id: item.id, quantity: item.quantity })), phone }),
      });
      const result = await response.json() as { error?: string; paymentSessionId?: string; mode?: "sandbox" | "production" };
      if (!response.ok || !result.paymentSessionId || !result.mode) throw new Error(result.error || "Payment could not be started.");
      await openCashfreeCheckout(result.paymentSessionId, result.mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be started.");
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/cart" className="text-sm font-semibold">Back to cart</Link></div></header>
    <section className="mx-auto grid max-w-4xl gap-8 px-6 py-12 md:grid-cols-[1fr_18rem]">
      <div className="rounded-2xl bg-white p-6 shadow-sm"><h1 className="text-3xl font-black">Secure checkout</h1><p className="mt-2 text-sm text-slate-600">Prices are rechecked on the server before Cashfree opens. Affiliate products are never charged here.</p><label className="mt-7 block text-sm font-bold">Mobile number<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={14} placeholder="9876543210" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label><p className="mt-2 text-xs leading-5 text-slate-500">Used only for this payment and required by Cashfree.</p>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}<button type="button" onClick={pay} disabled={!configured || loading || !items.length} className="mt-6 w-full rounded-xl bg-slate-950 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Opening Cashfree..." : configured ? `Pay ${total}` : "Cashfree setup pending"}</button>{!configured && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">No payment can be charged until the server-only Cashfree credentials are added.</p>}<Link href="/marketplace" className="mt-4 inline-block text-sm font-bold text-emerald-700">Continue browsing</Link></div>
      <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">Order summary</h2><p className="mt-4 text-sm text-slate-600">{items.length} item{items.length === 1 ? "" : "s"}</p><p className="mt-2 text-2xl font-black">{total}</p><p className="mt-4 text-xs leading-5 text-slate-500">Orders are only created after verified payment-webhook confirmation.</p></aside>
    </section>
  </main>;
}

"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export function CheckoutView() {
  const { items, totalPaise } = useCart();
  const total = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(totalPaise / 100);

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/cart" className="text-sm font-semibold">Back to cart</Link></div></header>
    <section className="mx-auto grid max-w-4xl gap-8 px-6 py-12 md:grid-cols-[1fr_18rem]">
      <div className="rounded-2xl bg-white p-6 shadow-sm"><h1 className="text-3xl font-black">Checkout</h1><p className="mt-2 text-sm text-slate-600">Your contact, payment and order details will appear here once the verified Cashfree gateway is connected.</p><div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p className="font-bold">Online checkout is not enabled yet.</p><p className="mt-1">Orders and charges are disabled until Cashfree and its secure webhook are configured. No amount can be charged from this page.</p><Link href="/marketplace" className="mt-3 inline-block font-bold underline underline-offset-4">Continue browsing</Link></div></div>
      <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-bold">Order summary</h2><p className="mt-4 text-sm text-slate-600">{items.length} item{items.length === 1 ? "" : "s"}</p><p className="mt-2 text-2xl font-black">{total}</p><p className="mt-4 text-xs leading-5 text-slate-500">Orders are only created after verified payment-webhook confirmation.</p></aside>
    </section>
  </main>;
}

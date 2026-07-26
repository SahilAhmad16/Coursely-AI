"use client";

import { useActionState } from "react";
import { createSellerStore } from "@/app/actions/store";

export function SellerStoreApplicationForm() {
  const [state, action, pending] = useActionState(createSellerStore, {});

  return <section className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
    <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Step 1 of 3 · seller application</p>
    <h2 className="mt-2 text-2xl font-black">Create your seller store</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This creates your seller profile only. You will submit verification next. Product and service upload stays locked until Coursely AI approves the seller account.</p>
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold">Store name<input name="storeName" minLength={2} maxLength={80} required placeholder="Studio Sahil" className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
      <label className="text-sm font-bold">Store URL<input name="storeSlug" minLength={3} maxLength={60} required placeholder="studio-sahil" className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">Letters, numbers and hyphens only.</span></label>
      <label className="text-sm font-bold sm:col-span-2">Store introduction (optional)<textarea name="storeDescription" maxLength={500} placeholder="What will you sell or offer?" className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
      {state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{state.error}</p>}
      <button disabled={pending} className="w-fit rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 sm:col-span-2">{pending ? "Creating seller store..." : "Create seller store and continue"}</button>
    </form>
  </section>;
}

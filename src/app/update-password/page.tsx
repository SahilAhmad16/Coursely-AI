"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";

export default function UpdatePasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, {});

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="font-black">Coursely AI</Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-wider text-emerald-700">Account security</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Choose a new password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use a unique password with at least 10 characters. This page only works from your secure reset link.</p>
        <form action={action} className="mt-7 space-y-5">
          <label className="block text-sm font-bold">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          <label className="block text-sm font-bold">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
          {state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{state.error}</p>}
          {state.message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{state.message} <Link href="/start" className="font-bold underline">Choose your path</Link></p>}
          <button disabled={pending} className="w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">{pending ? "Updating password..." : "Save new password"}</button>
        </form>
      </section>
    </main>
  );
}

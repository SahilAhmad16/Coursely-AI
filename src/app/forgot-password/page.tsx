"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><Link href="/" className="font-black">Coursely AI</Link><h1 className="mt-8 text-3xl font-black">Reset password</h1><p className="mt-3 text-slate-600">We will send a secure password-reset link to your email.</p><form action={action}><input name="email" className="mt-6 w-full rounded-xl border border-slate-300 p-3" type="email" required autoComplete="email" placeholder="you@example.com" />{state.error && <p className="mt-4 text-sm text-rose-700">{state.error}</p>}{state.message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{state.message}</p>}<button disabled={pending} className="mt-4 w-full rounded-xl bg-slate-950 py-3 font-bold text-white disabled:opacity-50">{pending ? "Sending..." : "Send reset link"}</button></form></section></main>;
}

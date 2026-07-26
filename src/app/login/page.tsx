"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { signIn } from "@/app/actions/auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, {});
  const [validationError, setValidationError] = useState("");

  function validateLogin(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      event.preventDefault();
      setValidationError("Enter your email and password, then select Log in.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      event.preventDefault();
      setValidationError("Enter a valid email address.");
      return;
    }

    setValidationError("");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <form action={action} noValidate onSubmit={validateLogin} onInput={() => setValidationError("")} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <Link href="/" className="font-black">Coursely AI</Link>
        <h1 className="mt-8 text-3xl font-black">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to buy, sell, and manage your orders.</p>
        <label className="mt-6 block text-sm font-bold">
          Email
          <input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-300 p-3" placeholder="you@example.com" />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
        </label>
        {(validationError || state.error) && <p role="alert" aria-live="polite" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{validationError || state.error}</p>}
        <a className="mt-3 block text-right text-sm font-semibold text-emerald-700" href="/forgot-password">Forgot password?</a>
        <button type="submit" disabled={pending} className="mt-6 w-full rounded-xl bg-slate-950 py-3 font-bold text-white disabled:opacity-50">{pending ? "Signing in..." : "Log in"}</button>
        <GoogleSignInButton />
        <p className="mt-5 text-center text-sm text-slate-600">
          New here?{" "}
          <a href="/register" data-testid="login-register-link" className="font-bold text-emerald-700">Create an account</a>
        </p>
      </form>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { signUp } from "@/app/actions/auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, {});
  const [validationError, setValidationError] = useState("");

  function validateRegistration(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    let error = "";
    if (fullName.length < 2) error = "Enter your full name.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) error = "Enter a valid email address.";
    else if (password.length < 10) error = "Password must contain at least 10 characters.";

    if (error) {
      event.preventDefault();
      setValidationError(error);
      return;
    }

    setValidationError("");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <form action={action} noValidate onSubmit={validateRegistration} onInput={() => setValidationError("")} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <Link href="/" className="font-black">Coursely AI</Link>
        <h1 className="mt-8 text-3xl font-black">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">Buy products, book services, or open your seller store.</p>
        <label className="mt-6 block text-sm font-bold">
          Full name
          <input name="fullName" required autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Email
          <input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Password
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-slate-300 p-3" />
          <span className="mt-1 block font-normal text-slate-500">At least 10 characters.</span>
        </label>
        {(validationError || state.error) && <p role="alert" aria-live="polite" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{validationError || state.error}</p>}
        {state.message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{state.message}</p>}
        <button type="submit" disabled={pending} className="mt-6 w-full rounded-xl bg-slate-950 py-3 font-bold text-white disabled:opacity-50">{pending ? "Creating account..." : "Create account"}</button>
        <GoogleSignInButton />
        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered?{" "}
          <a href="/login" data-testid="register-login-link" className="font-bold text-emerald-700">Log in</a>
        </p>
      </form>
    </main>
  );
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  async function signInWithGoogle() {
    setLoading(true); setError(undefined);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/start` } });
    if (authError) { setError("Google sign-in is not enabled yet. The owner must enable Google in Supabase Authentication first."); setLoading(false); }
  }
  return <div className="mt-5"><div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div><p className="relative mx-auto w-fit bg-white px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">or</p></div><button type="button" onClick={signInWithGoogle} disabled={loading} className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 font-bold text-slate-800 transition hover:border-slate-950 disabled:opacity-50"><span className="text-lg">G</span>{loading ? "Opening Google..." : "Continue with Google"}</button>{error && <p className="mt-2 text-sm text-rose-700">{error}</p>}</div>;
}

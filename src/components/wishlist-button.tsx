"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function WishlistButton({ productId, initiallySaved = false }: { productId: string; initiallySaved?: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");
      const { error: requestError } = saved
        ? await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId)
        : await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
      if (requestError) throw requestError;
      setSaved((value) => !value);
    } catch {
      setError("Could not update your wishlist. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3"><button type="button" onClick={toggle} disabled={busy} className={`w-full rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${saved ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-300 bg-white text-slate-800 hover:border-rose-300 hover:text-rose-700"}`}>{saved ? "♥ Saved to wishlist" : "♡ Save to wishlist"}</button>{error && <p className="mt-2 text-xs text-rose-700">{error}</p>}</div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startConversation } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";

export function ContactSeller({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  async function openConversation() {
    setError(undefined);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    startTransition(async () => {
      const result = await startConversation(productId);
      if (result.conversationId) router.push(`/messages/${result.conversationId}`);
      else setError(result.error ?? "Conversation could not be opened.");
    });
  }

  return <div className="mt-4"><button type="button" onClick={openConversation} disabled={pending} className="w-full rounded-xl border border-slate-300 bg-white py-3 font-bold text-slate-950 transition hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-50">{pending ? "Opening chat..." : "Message service provider"}</button>{error && <p className="mt-2 text-sm text-rose-700">{error}</p>}</div>;
}

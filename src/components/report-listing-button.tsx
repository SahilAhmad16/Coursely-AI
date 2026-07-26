"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const reasons = [
  ["misleading", "Misleading information"],
  ["copyright", "Copyright or copied content"],
  ["unsafe", "Unsafe or prohibited item"],
  ["spam", "Spam or scam"],
  ["other", "Other"],
] as const;

export function ReportListingButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number][0]>("misleading");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const { error } = await supabase.from("listing_reports").insert({
      product_id: productId,
      reporter_id: user.id,
      reason,
      details: details.trim() || null,
    });
    if (error) {
      setMessage(error.code === "23505" ? "You have already reported this listing. Our team will review it." : "Your report could not be sent. Please try again.");
      setIsSaving(false);
      return;
    }
    setMessage("Thank you. Your report has been sent to the Coursely AI review team.");
    setDetails("");
    setIsSaving(false);
  }

  if (!isOpen) return <button type="button" onClick={() => setIsOpen(true)} className="mt-4 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-rose-700">Report this listing</button>;

  return <form onSubmit={submitReport} className="mt-5 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-left">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-950">Report this listing</p><p className="mt-1 text-xs leading-5 text-slate-600">Reports are private and reviewed by Coursely AI.</p></div><button type="button" onClick={() => setIsOpen(false)} className="text-xs font-bold text-slate-500">Close</button></div>
    <label className="mt-4 block text-xs font-bold text-slate-700">Reason<select value={reason} onChange={(event) => setReason(event.target.value as (typeof reasons)[number][0])} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-rose-400">{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="mt-3 block text-xs font-bold text-slate-700">Optional details<textarea value={details} onChange={(event) => setDetails(event.target.value.slice(0, 1000))} maxLength={1000} rows={3} className="mt-1.5 block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-rose-400" placeholder="Tell us what happened" /></label>
    <div className="mt-3 flex items-center gap-3"><button disabled={isSaving} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{isSaving ? "Sending..." : "Send report"}</button>{message && <p className="text-xs font-medium text-slate-600" role="status">{message}</p>}</div>
  </form>;
}

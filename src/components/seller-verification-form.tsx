"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitSellerVerification } from "@/app/actions/seller-verification";
import { createClient } from "@/lib/supabase/client";

type Verification = {
  status: "submitted" | "approved" | "changes_requested" | "rejected";
  legalName: string;
  businessType: string;
  documentKind: string;
  documentLast4: string;
  addressLine: string;
  reviewNote: string | null;
  submittedAt: string;
};

const statusStyle = {
  submitted: "border-amber-200 bg-amber-50 text-amber-900",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  changes_requested: "border-sky-200 bg-sky-50 text-sky-950",
  rejected: "border-rose-200 bg-rose-50 text-rose-950",
};

export function SellerVerificationForm({ storeId, verification }: { storeId: string; verification: Verification | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const canSubmit = !verification || verification.status === "changes_requested" || verification.status === "rejected";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setSuccess(undefined);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const document = formData.get("document") as File | null;
    if (!document?.size) {
      setBusy(false);
      setError("Choose a verification document first.");
      return;
    }
    if (!new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]).has(document.type) || document.size > 5 * 1024 * 1024) {
      setBusy(false);
      setError("Use a PDF, JPG, PNG, or WebP document up to 5 MB.");
      return;
    }

    let uploadedPath: string | null = null;
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");
      const extension = document.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      uploadedPath = `${user.id}/${storeId}/verification-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("seller-kyc")
        .upload(uploadedPath, document, { cacheControl: "3600", contentType: document.type, upsert: false });
      if (uploadError) throw new Error("Document upload failed. Please try again.");

      formData.set("documentPath", uploadedPath);
      formData.delete("document");
      const result = await submitSellerVerification(formData);
      if (result.error) throw new Error(result.error);
      if (result.replacedPath && result.replacedPath !== uploadedPath) {
        await supabase.storage.from("seller-kyc").remove([result.replacedPath]);
      }
      form.reset();
      setSuccess(result.success ?? "Verification submitted.");
      router.refresh();
    } catch (caught) {
      if (uploadedPath) {
        const supabase = createClient();
        await supabase.storage.from("seller-kyc").remove([uploadedPath]);
      }
      setError(caught instanceof Error ? caught.message : "Verification could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Seller verification</p>
        <h2 className="mt-1 text-xl font-black">Verify your store before you publish</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Upload one business-identification document. The document remains private and is only available to you and Coursely AI administrators. Never upload bank passwords, card details, or OTPs.</p>
      </div>
      {verification && <span className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${statusStyle[verification.status]}`}>{verification.status.replaceAll("_", " ")}</span>}
    </div>

    {verification && <div className={`mt-5 rounded-xl border p-4 text-sm ${statusStyle[verification.status]}`}>
      <p className="font-bold">{verification.status === "approved" ? "Your seller store is verified." : verification.status === "submitted" ? "Your documents are with the admin for review." : "Update the requested information and submit again."}</p>
      {verification.reviewNote && <p className="mt-2 leading-6"><strong>Admin note:</strong> {verification.reviewNote}</p>}
      <p className="mt-2 text-xs font-medium opacity-80">Last submitted {new Date(verification.submittedAt).toLocaleString("en-IN")}</p>
    </div>}

    {canSubmit && <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="storeId" value={storeId} />
      <label className="text-sm font-bold sm:col-span-2">Legal name<input name="legalName" required minLength={2} maxLength={120} defaultValue={verification?.legalName ?? ""} placeholder="Name shown on your business document" className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
      <label className="text-sm font-bold">Business type<select name="businessType" required defaultValue={verification?.businessType ?? "individual"} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="individual">Individual / freelancer</option><option value="sole_proprietor">Sole proprietor</option><option value="partnership">Partnership</option><option value="company">Company</option></select></label>
      <label className="text-sm font-bold">Document type<select name="documentKind" required defaultValue={verification?.documentKind ?? "pan"} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="pan">PAN</option><option value="gst">GST registration</option><option value="business_registration">Business registration</option><option value="government_id">Government ID</option><option value="other">Other business document</option></select></label>
      <label className="text-sm font-bold">Last 4 characters of document ID<input name="documentLast4" required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" defaultValue={verification?.documentLast4 ?? ""} placeholder="AB12" className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal uppercase" /></label>
      <label className="text-sm font-bold">Document file<input name="document" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-2 block w-full text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">PDF, JPG, PNG, or WebP · maximum 5 MB.</span></label>
      <label className="text-sm font-bold sm:col-span-2">Business / operating address<textarea name="addressLine" required minLength={10} maxLength={500} defaultValue={verification?.addressLine ?? ""} placeholder="Street, city, state and PIN code" className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>
      {error && <p className="sm:col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {success && <p className="sm:col-span-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
      <div className="sm:col-span-2"><button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{busy ? "Submitting securely..." : verification ? "Update and resubmit verification" : "Submit for verification"}</button></div>
    </form>}
  </section>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { attachDigitalFile } from "@/app/actions/listings";
import { createClient } from "@/lib/supabase/client";

const allowedTypes = new Set([
  "application/pdf", "application/zip", "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "image/jpeg", "image/png", "image/webp", "video/mp4", "audio/mpeg",
]);
const maxBytes = 100 * 1024 * 1024;

export function DigitalFileUploader({ productId, fileName }: { productId: string; fileName: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [uploading, setUploading] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    const form = new FormData(event.currentTarget);
    const file = form.get("digitalFile");
    if (!(file instanceof File) || !file.size) return setError("Choose a digital delivery file first.");
    if (!allowedTypes.has(file.type)) return setError("Use PDF, ZIP, Office file, image, MP4, MP3, TXT, or CSV.");
    if (file.size > maxBytes) return setError("Digital files must be 100 MB or smaller.");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return setError("Secure file storage is still connecting.");

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please log in again before uploading.");
      const safeFileName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-120) || "digital-download";
      const path = `${user.id}/${productId}/${crypto.randomUUID()}-${safeFileName}`;
      const { error: uploadError } = await supabase.storage.from("digital-assets").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error("Digital file could not be uploaded. Please try again.");
      const result = await attachDigitalFile(productId, path, file.name.slice(0, 160));
      if (result.error) {
        await supabase.storage.from("digital-assets").remove([path]);
        throw new Error(result.error);
      }
      if (result.replacedPath) await supabase.storage.from("digital-assets").remove([result.replacedPath]);
      event.currentTarget.reset();
      setSuccess(result.success ?? "Private delivery file attached.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Digital file upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return <form onSubmit={upload} className="mt-5 space-y-4 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-5"><div><label className="block text-sm font-bold">Private delivery file<input name="digitalFile" type="file" accept=".pdf,.zip,.docx,.pptx,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.mp4,.mp3" required className="mt-2 block w-full text-sm" /></label><p className="mt-1 text-xs leading-5 text-slate-600">PDF, ZIP, Office files, images, MP4, MP3, TXT, or CSV · maximum 100 MB. This file is private to you; automatic customer delivery is enabled only after payment setup.</p></div>{fileName && <p className="rounded-lg bg-white p-3 text-sm text-violet-950"><span className="font-bold">Current file:</span> {fileName}</p>}{error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{success && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}<button disabled={uploading} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{uploading ? "Uploading securely..." : fileName ? "Replace delivery file" : "Upload delivery file"}</button></form>;
}

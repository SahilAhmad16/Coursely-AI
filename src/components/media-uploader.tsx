"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProductMedia } from "@/app/actions/listings";
import { createClient } from "@/lib/supabase/client";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

export function MediaUploader({ productId }: { productId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [uploading, setUploading] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(undefined);
    const form = new FormData(event.currentTarget);
    const file = form.get("image");
    const altText = String(form.get("altText") ?? "").trim();
    if (!(file instanceof File) || !file.size) return setError("Choose a JPG, PNG, or WebP image first.");
    if (!allowedTypes.has(file.type)) return setError("Only JPG, PNG, and WebP images are allowed.");
    if (file.size > maxBytes) return setError("Image must be 10 MB or smaller.");
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return setError("Secure file storage is still connecting.");

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Please log in again before uploading.");
      const safeFileName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100) || "product-image";
      const path = `${user.id}/${productId}/${crypto.randomUUID()}-${safeFileName}`;
      const { error: uploadError } = await supabase.storage.from("product-media").upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error("Image could not be uploaded. Please try again.");
      const result = await addProductMedia(productId, path, altText);
      if (result.error) {
        await supabase.storage.from("product-media").remove([path]);
        throw new Error(result.error);
      }
      event.currentTarget.reset();
      setSuccess(result.success ?? "Product image uploaded.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="mt-5 space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
      <div>
        <label className="block text-sm font-bold">Product image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full text-sm" /></label>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP · maximum 10 MB. Files are tied to this seller account.</p>
      </div>
      <label className="block text-sm font-bold">Image description (optional)<input name="altText" maxLength={160} placeholder="Example: Blue ecommerce dashboard template preview" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" /></label>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {success && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
      <button disabled={uploading} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{uploading ? "Uploading..." : "Upload image"}</button>
    </form>
  );
}

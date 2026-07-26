"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { attachStoreAsset } from "@/app/actions/store";
import { createClient } from "@/lib/supabase/client";

export function StoreAssetUploader({ storeId, kind, currentPath }: { storeId: string; kind: "logo" | "banner"; currentPath: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const title = kind === "logo" ? "Store logo" : "Store banner";

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined); setSuccess(undefined);
    const file = new FormData(event.currentTarget).get("asset");
    if (!(file instanceof File) || !file.size) return setError("Choose an image first.");
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 5 * 1024 * 1024) return setError("Use a JPG, PNG, or WebP image up to 5 MB.");
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${user.id}/${storeId}/${kind}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("store-assets").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (uploadError) throw new Error("Image upload failed. Please try again.");
      const result = await attachStoreAsset(storeId, kind, path);
      if (result.error) { await supabase.storage.from("store-assets").remove([path]); throw new Error(result.error); }
      if (result.replacedPath) await supabase.storage.from("store-assets").remove([result.replacedPath]);
      event.currentTarget.reset(); setSuccess(result.success ?? `${title} saved.`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Image upload failed."); } finally { setBusy(false); }
  }

  return <form onSubmit={upload} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><label className="block text-sm font-bold">{title}<input name="asset" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full text-sm" /></label><p className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP · up to 5 MB{currentPath ? " · replacing an existing image" : ""}.</p>{error && <p className="mt-2 text-sm text-rose-700">{error}</p>}{success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}<button disabled={busy} className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Uploading..." : `Upload ${kind}`}</button></form>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendFileMessage } from "@/app/actions/messages";
import { createClient } from "@/lib/supabase/client";

const allowedTypes = new Set(["application/pdf", "application/zip", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv", "video/mp4", "audio/mpeg"]);

export function MessageFileUploader({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined); setSuccess(undefined);
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a file first.");
    if (!allowedTypes.has(file.type) || file.size > 25 * 1024 * 1024) return setError("Use PDF, ZIP, image, TXT, CSV, MP4, or MP3 up to 25 MB.");
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in again.");
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-120) || "service-file";
      const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("message-files").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("File upload failed. Please try again.");
      const result = await sendFileMessage(conversationId, path, file.name.slice(0, 160), file.type, file.size);
      if (result.error) { await supabase.storage.from("message-files").remove([path]); throw new Error(result.error); }
      event.currentTarget.reset(); setSuccess(result.success ?? "File shared."); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "File upload failed."); } finally { setBusy(false); }
  }

  return <form onSubmit={upload} className="mt-3 flex flex-wrap items-center gap-3"><input name="file" type="file" accept=".pdf,.zip,.jpg,.jpeg,.png,.webp,.txt,.csv,.mp4,.mp3" required className="max-w-full text-sm" /><button disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">{busy ? "Sharing..." : "Share file"}</button>{error && <p className="text-sm text-rose-700">{error}</p>}{success && <p className="text-sm text-emerald-700">{success}</p>}</form>;
}

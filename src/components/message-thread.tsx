"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/app/actions/messages";
import { MessageFileUploader } from "@/components/message-file-uploader";

export function MessageThread({ conversationId, currentUserId, messages }: { conversationId: string; currentUserId: string; messages: { id: string; senderId: string; body: string; createdAt: string; attachments: { id: string; fileName: string; url: string | null }[] }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(sendMessage, {});
  useEffect(() => { const interval = window.setInterval(() => router.refresh(), 8000); return () => window.clearInterval(interval); }, [router]);
  return <><div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl bg-slate-100 p-4">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.senderId === currentUserId ? "ml-auto bg-slate-950 text-white" : "bg-white text-slate-800 shadow-sm"}`}><p>{message.body}</p>{message.attachments.map((attachment) => attachment.url ? <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className={`mt-3 block rounded-lg border px-3 py-2 text-xs font-bold ${message.senderId === currentUserId ? "border-white/25 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-emerald-700"}`}>↗ {attachment.fileName}</a> : <p key={attachment.id} className="mt-3 text-xs">{attachment.fileName}</p>)}<p className={`mt-1 text-[11px] ${message.senderId === currentUserId ? "text-slate-300" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleString()}</p></div>) : <p className="p-6 text-center text-sm text-slate-500">Start the conversation with a clear description of what you need.</p>}</div><form action={action} className="mt-4"><input type="hidden" name="conversationId" value={conversationId} /><div className="flex gap-3"><input name="body" maxLength={2000} required placeholder="Write a message..." className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3" /><button disabled={pending} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50">Send</button></div>{state.error && <p className="mt-2 text-sm text-rose-700">{state.error}</p>}</form><MessageFileUploader conversationId={conversationId} /></>;
}

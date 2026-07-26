import Link from "next/link";
import { redirect } from "next/navigation";
import { ServiceSellerLocked } from "@/components/service-seller-locked";
import { getCurrentUserSellerAccess } from "@/lib/service-seller-plan";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Conversation = { id: string; customer_id: string; seller_id: string; status: string; updated_at: string; products: { title: string; slug: string } | { title: string; slug: string }[] | null };

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sellerAccess = await getCurrentUserSellerAccess(supabase, user.id);
  if (sellerAccess.isLocked) return <ServiceSellerLocked subscriptions={sellerAccess.lockedPlans} />;
  const { data } = await supabase.from("conversations").select("id,customer_id,seller_id,status,updated_at,products(title,slug)").order("updated_at", { ascending: false });
  const conversations = (data ?? []) as Conversation[];
  return <main className="min-h-screen bg-slate-100"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/marketplace" className="text-sm font-semibold">Marketplace</Link></div></header><section className="mx-auto max-w-4xl px-6 py-10"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Messages</p><h1 className="mt-2 text-4xl font-black">Your service conversations</h1><p className="mt-3 text-slate-600">Messages refresh automatically while you keep a conversation open.</p>{conversations.length ? <div className="mt-8 space-y-3">{conversations.map((conversation) => { const product = Array.isArray(conversation.products) ? conversation.products[0] : conversation.products; return <Link key={conversation.id} href={`/messages/${conversation.id}`} className="block rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="font-bold">{product?.title ?? "Service conversation"}</p><p className="mt-1 text-sm text-slate-500">{conversation.customer_id === user.id ? "You are the customer" : "You are the provider"} · {conversation.status}</p></Link>; })}</div> : <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">No conversations yet</h2><p className="mt-2 text-sm text-slate-600">Open a published service and choose “Message service provider”.</p></div>}</section></main>;
}

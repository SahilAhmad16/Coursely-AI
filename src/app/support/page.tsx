import Link from "next/link";
import { createSupportTicket } from "@/app/actions/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const faqs = [
  ["What can I sell?", "Coursely AI supports original digital products, professional services, and approved affiliate product offers. Direct physical inventory is not accepted."],
  ["How does the free trial work?", "Each seller category gets one free 28-day period. After it ends, that category stays locked until its 28-day plan is renewed."],
  ["Where do I buy an affiliate product?", "The listing opens the approved partner website. That partner handles checkout, delivery, tracking, returns, and the affiliate payout."],
  ["When can a digital buyer download a file?", "Only after a real payment is confirmed by the payment provider webhook. Live payments and downloads will be enabled in the final production phase."],
  ["How are service problems handled?", "Customer and provider can use the work area for milestones, delivery, revisions, and disputes. Open disputes enter the admin review queue."],
];

type Ticket = { id: string; category: string; subject: string; status: string; admin_note: string | null; created_at: string };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("support_tickets").select("id,category,subject,status,admin_note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const tickets = (data ?? []) as Ticket[];

  return <main className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/marketplace" className="text-sm font-semibold">Marketplace</Link></div></header>
    <section className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Help centre</p><h1 className="mt-2 text-4xl font-black">Answers and support</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Find common answers or open a private support ticket after signing in. Never include passwords, OTPs, card details, API keys, or full identity-document numbers.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">{faqs.map(([question, answer]) => <article key={question} className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="font-black">{question}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p></article>)}</div>
      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Contact support</h2>{params.created && <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Support ticket created successfully.</p>}{params.error && <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">We could not create that ticket. Check every field and try again.</p>}{user ? <form action={createSupportTicket} className="mt-5 grid gap-4"><label className="text-sm font-bold">Category<select name="category" defaultValue="account" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal"><option value="account">Account</option><option value="seller">Seller verification or plan</option><option value="listing">Listing</option><option value="payment">Payment</option><option value="digital_delivery">Digital delivery</option><option value="service">Professional service</option><option value="affiliate">Affiliate product</option><option value="other">Other</option></select></label><label className="text-sm font-bold">Subject<input name="subject" required minLength={5} maxLength={140} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label><label className="text-sm font-bold">How can we help?<textarea name="message" required minLength={20} maxLength={4000} className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label><button className="w-fit rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Create ticket</button></form> : <Link href="/login?next=/support" className="mt-5 inline-block rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Log in to contact support</Link>}</section>
      {user && <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">My tickets</h2>{tickets.length ? <div className="mt-5 space-y-3">{tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{ticket.subject}</p><p className="mt-1 text-xs capitalize text-slate-500">{ticket.category.replaceAll("_", " ")} · {new Date(ticket.created_at).toLocaleString("en-IN")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{ticket.status.replaceAll("_", " ")}</span></div>{ticket.admin_note && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950"><strong>Support response:</strong> {ticket.admin_note}</p>}</article>)}</div> : <p className="mt-4 text-sm text-slate-600">You have not opened a support ticket.</p>}</section>}
    </section>
  </main>;
}

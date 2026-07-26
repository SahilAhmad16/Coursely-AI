import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { policies, type PolicySlug } from "@/lib/policies";

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = policies[slug as PolicySlug];
  return policy ? { title: `${policy.title} | Coursely AI`, description: policy.intro } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policies[slug as PolicySlug];
  if (!policy) notFound();
  return <main className="min-h-screen bg-slate-100"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/support" className="text-sm font-semibold">Help centre</Link></div></header><article className="mx-auto max-w-4xl px-6 py-12"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Coursely AI policy</p><h1 className="mt-2 text-4xl font-black">{policy.title}</h1><p className="mt-4 max-w-2xl leading-7 text-slate-600">{policy.intro}</p><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Pre-launch policy draft. Final business identity, contact, jurisdiction, tax, payment-provider, and effective-date details will be reviewed before real-money launch.</p><div className="mt-8 space-y-5">{policy.sections.map(([title, body]) => <section key={title} className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 leading-7 text-slate-600">{body}</p></section>)}</div></article></main>;
}

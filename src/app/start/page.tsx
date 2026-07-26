import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase/server";

export default async function StartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/register");

  const name = String(user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "there").trim();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] px-6 py-5 text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden"><div className="coursely-orb absolute -left-24 top-10 size-96 rounded-full bg-emerald-200/45 blur-3xl" /><div className="coursely-orb absolute right-[-7rem] top-8 size-96 rounded-full bg-sky-200/45 blur-3xl [animation-delay:-4s]" /><div className="coursely-grid absolute inset-0 opacity-35" /></div>
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between"><BrandLogo /><Link href="/account" className="rounded-full border border-slate-200 bg-white/75 px-4 py-2 text-sm font-bold shadow-sm backdrop-blur transition hover:border-emerald-400">My account</Link></header>
      <section className="relative z-10 mx-auto max-w-5xl pb-16 pt-20 text-center md:pt-28"><p className="coursely-rise text-sm font-bold uppercase tracking-wider text-emerald-700">Welcome, {name}</p><h1 className="coursely-rise coursely-rise-delay mt-3 text-4xl font-black tracking-tight md:text-6xl">What would you like to do?</h1><p className="coursely-rise coursely-rise-delay mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">Choose a path for today. You can always switch later from your account—buying does not automatically make you a seller.</p>
        <div className="mt-12 grid gap-6 text-left md:grid-cols-2">
          <Link href="/marketplace" className="coursely-rise group rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5 transition duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-950/10"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">⌕</span><p className="mt-8 text-sm font-bold uppercase tracking-wider text-emerald-700">I want to buy</p><h2 className="mt-2 text-3xl font-black">Explore the marketplace</h2><p className="mt-4 leading-7 text-slate-600">Find products, digital downloads and professional services. Save items, message sellers and manage your orders.</p><span className="mt-8 inline-block font-bold text-emerald-700 transition group-hover:translate-x-1">Browse listings →</span></Link>
          <Link href="/dashboard?setup=seller" className="coursely-rise coursely-rise-delay group rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/20 transition duration-300 hover:-translate-y-1 hover:bg-emerald-800"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-2xl text-slate-950">✦</span><p className="mt-8 text-sm font-bold uppercase tracking-wider text-emerald-300">I want to sell</p><h2 className="mt-2 text-3xl font-black">Apply for a seller store</h2><p className="mt-4 leading-7 text-slate-300">Complete your store application first. Coursely AI reviews verification before product uploads and publishing are unlocked.</p><span className="mt-8 inline-block font-bold text-emerald-300 transition group-hover:translate-x-1">Start seller application →</span></Link>
        </div>
      </section>
    </main>
  );
}

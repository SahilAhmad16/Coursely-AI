import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { MarketplaceSearch } from "@/components/marketplace-search";
import { PromotionalBanner } from "@/components/promotional-banner";

const categoryCards = [
  ["Digital", "Templates, ebooks, assets and software", "digital", "01"],
  ["Services", "Design, editing, development and consulting", "service", "02"],
  ["Products", "Approved affiliate offers from trusted partner platforms", "affiliate", "03"],
] as const;

const trustPoints = ["Clear listings", "Secure accounts", "Real people"];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-white selection:bg-emerald-300 selection:text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="coursely-aurora absolute -left-40 top-[-11rem] size-[38rem] rounded-full bg-emerald-400/25 blur-[120px]" />
        <div className="coursely-aurora absolute right-[-15rem] top-44 size-[36rem] rounded-full bg-violet-500/20 blur-[130px] [animation-delay:-6s]" />
        <div className="coursely-dark-grid absolute inset-x-0 top-0 h-[60rem] opacity-60" />
        <div className="coursely-grain absolute inset-0 opacity-30" />
      </div>
      <PromotionalBanner placement="home" dark />

      <header className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-5 md:px-8">
        <BrandLogo inverted className="drop-shadow-lg drop-shadow-black/40" />
        <MarketplaceSearch className="order-3 w-full border-white/15 bg-white shadow-2xl shadow-black/30 focus-within:border-emerald-300 focus-within:ring-emerald-300/20 lg:order-none lg:ml-auto lg:w-[22rem]" />
        <nav className="order-4 flex w-full items-center justify-center gap-5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400 lg:order-none lg:w-auto lg:justify-start">
          <Link href="/marketplace" className="transition hover:text-emerald-300">Marketplace</Link>
          <a href="#how-it-works" className="transition hover:text-emerald-300">How it works</a>
          <a href="#discover" className="transition hover:text-emerald-300">Discover</a>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <a href="/login" data-testid="header-login-link" className="rounded-full border border-white/15 bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-slate-700">Log in</a>
          <a href="/register" data-testid="header-register-link" className="rounded-full border border-white/15 bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-slate-700">Create account</a>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-8 pt-14 md:px-8 lg:grid-cols-[1.04fr_.96fr] lg:pb-10 lg:pt-24">
        <div className="coursely-rise">
          <div className="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300"><span className="coursely-status-dot size-2 rounded-full bg-emerald-300" />A better way to discover</div>
          <h1 className="max-w-4xl text-5xl font-black leading-[.92] tracking-[-.065em] text-white sm:text-6xl md:text-7xl lg:text-8xl">The marketplace<br />that feels <span className="coursely-shine-text">alive.</span></h1>
          <p className="mt-8 max-w-xl text-base leading-8 text-slate-300 md:text-lg">Find useful products, original digital downloads and skilled professionals in one place. Coursely AI makes independent commerce easier to explore.</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-400"><Link href="/marketplace" className="group inline-flex items-center gap-2 font-bold text-white transition hover:text-emerald-300">Explore marketplace <span className="transition group-hover:translate-x-1">→</span></Link><span className="hidden h-4 w-px bg-white/20 sm:block" /><span>Already a member? <Link href="/login" className="font-bold text-emerald-300 hover:text-emerald-200">Log in</Link></span></div>
        </div>

        <div className="coursely-rise coursely-rise-delay relative mx-auto w-full max-w-xl lg:max-w-none">
          <div aria-hidden="true" className="pointer-events-none coursely-orbit absolute left-1/2 top-1/2 size-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/20" />
          <div aria-hidden="true" className="pointer-events-none coursely-orbit absolute left-1/2 top-1/2 size-[31rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 [animation-delay:-8s]" />
          <div className="relative mx-auto min-h-[29rem] max-w-[32rem] rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[.13] to-white/[.035] p-4 shadow-[0_30px_80px_rgba(0,0,0,.44)] backdrop-blur-xl sm:min-h-[33rem] sm:p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex gap-1.5"><span className="size-2 rounded-full bg-rose-300/80" /><span className="size-2 rounded-full bg-amber-200/80" /><span className="size-2 rounded-full bg-emerald-300/80" /></div><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-slate-300">Live discovery</span></div>
            <div className="mt-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-300">Built for people</p><p className="mt-1 text-xl font-black tracking-tight">Made to move ideas.</p></div><span className="coursely-float grid size-12 place-items-center rounded-2xl bg-emerald-300 text-xl text-slate-950 shadow-lg shadow-emerald-300/20">✦</span></div>
            <div className="mt-6 grid gap-3">
              <article className="coursely-card-drift rounded-2xl border border-white/10 bg-[#10151d]/90 p-4 shadow-xl shadow-black/20"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-300 font-black text-slate-950">D</span><div><p className="font-bold">Digital products</p><p className="mt-1 text-xs text-slate-400">Learn, use and create.</p></div></div><span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">Instant</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="coursely-progress h-full w-3/4 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300" /></div></article>
              <article className="coursely-card-drift ml-auto w-[90%] rounded-2xl border border-white/10 bg-white/[.09] p-4 shadow-xl shadow-black/20 [animation-delay:-3s]"><div className="flex items-center justify-between"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-300 text-sm font-black text-slate-950">S</span><div><p className="font-bold">Professional services</p><p className="mt-1 text-xs text-slate-400">Talk. Scope. Deliver.</p></div></div><span className="size-2 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,.9)]" /></div></article>
              <article className="coursely-card-drift w-[86%] rounded-2xl border border-white/10 bg-white/[.06] p-4 shadow-xl shadow-black/20 [animation-delay:-5s]"><div className="flex items-center justify-between"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sky-200 text-sm font-black text-slate-950">P</span><div><p className="font-bold">Products</p><p className="mt-1 text-xs text-slate-400">Trusted affiliate offers, clearly shown.</p></div></div><span className="text-sm font-black text-sky-200">₹</span></div></article>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">{trustPoints.map((point) => <span key={point} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300">{point}</span>)}</div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 border-y border-white/10 bg-white/[.035]">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Simple by design</p><h2 className="mt-4 max-w-sm text-4xl font-black leading-tight tracking-tight">Start as a visitor. Choose later.</h2><p className="mt-5 max-w-sm leading-7 text-slate-400">Shopping and selling are separate decisions. You only enter seller setup after you have an account and choose that path.</p></div><div className="grid gap-3 md:grid-cols-3">{[["01", "Explore", "Search the marketplace freely."], ["02", "Create account", "Register when you are ready."], ["03", "Choose a path", "Buy or apply as a seller."]].map(([number, title, description], index) => <article key={number} className={`relative overflow-hidden rounded-3xl border border-white/10 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/40 ${index === 1 ? "bg-emerald-300 text-slate-950" : "bg-white/[.045]"}`}><span className={`text-xs font-black tracking-[.2em] ${index === 1 ? "text-slate-700" : "text-emerald-300"}`}>{number}</span><h3 className="mt-10 text-xl font-black">{title}</h3><p className={`mt-3 text-sm leading-6 ${index === 1 ? "text-slate-700" : "text-slate-400"}`}>{description}</p></article>)}</div></div>
        </div>
      </section>

      <section id="discover" className="relative z-10 mx-auto max-w-7xl px-5 py-24 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Discover differently</p><h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Three worlds. One place.</h2></div><Link href="/marketplace" className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-emerald-300 hover:bg-emerald-300 hover:text-slate-950">View marketplace</Link></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">{categoryCards.map(([name, description, type, number], index) => <Link key={name} href={`/marketplace?type=${type}`} className={`group relative min-h-72 overflow-hidden rounded-[1.75rem] border p-6 transition duration-500 hover:-translate-y-2 ${index === 0 ? "border-emerald-300/30 bg-gradient-to-b from-emerald-300/20 to-[#10151d]" : index === 1 ? "border-violet-300/25 bg-gradient-to-b from-violet-400/20 to-[#10151d]" : "border-sky-200/25 bg-gradient-to-b from-sky-300/15 to-[#10151d]"}`}><span className="absolute -right-5 -top-7 text-[9rem] font-black leading-none text-white/[.055] transition duration-500 group-hover:scale-110">{number}</span><div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07090d] to-transparent" /><div className="relative flex h-full flex-col justify-end"><span className="mb-auto text-xs font-bold uppercase tracking-[.2em] text-white/60">Explore</span><h3 className="text-3xl font-black tracking-tight">{name}</h3><p className="mt-3 max-w-64 leading-6 text-slate-300">{description}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-200">See what&apos;s inside <span className="transition group-hover:translate-x-1">→</span></span></div></Link>)}</div>
      </section>

      <section className="relative z-10 px-5 pb-24 md:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-300 via-emerald-400 to-cyan-300 p-8 text-slate-950 shadow-[0_30px_100px_rgba(16,185,129,.18)] md:p-14"><div aria-hidden="true" className="pointer-events-none coursely-cta-orb absolute -right-16 -top-20 size-80 rounded-full border-[32px] border-white/25" /><div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent" /><p className="relative text-xs font-black uppercase tracking-[.2em] text-emerald-950/65">The first step is simple</p><h2 className="relative mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">Make an account. Choose what you need.</h2><p className="relative mt-5 max-w-xl text-lg leading-8 text-emerald-950/75">Explore now, or create a free account when you are ready to buy, save items, or apply for a seller store.</p><Link href="/register" className="relative mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950">Create a free account</Link></div>
      </section>
    </main>
  );
}

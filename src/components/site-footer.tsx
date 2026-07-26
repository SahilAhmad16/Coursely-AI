import Link from "next/link";

const links = [
  ["/support", "Help & FAQ"],
  ["/policies/privacy", "Privacy"],
  ["/policies/terms", "Terms"],
  ["/policies/refunds", "Refunds"],
  ["/policies/sellers", "Seller policy"],
  ["/policies/affiliate", "Affiliate disclosure"],
] as const;

export function SiteFooter() {
  return <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Coursely AI</p><p className="mt-1 text-xs text-slate-500">Digital products, professional services, and approved affiliate products.</p></div><nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-2">{links.map(([href, label]) => <Link key={href} href={href} className="text-xs font-semibold text-slate-600 transition hover:text-emerald-700">{label}</Link>)}</nav></div></footer>;
}

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { MarketplaceBrowser } from "@/components/marketplace-browser";
import { MarketplaceSearch } from "@/components/marketplace-search";
import { PromotionalBanner } from "@/components/promotional-banner";
import { getActiveCategories, getPublishedProducts, isSupabaseConfigured } from "@/lib/data/marketplace";

export const dynamic = "force-dynamic";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; type?: string | string[] }> }) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const initialFilter = typeof params.type === "string" && ["digital", "service", "affiliate"].includes(params.type)
    ? params.type as "digital" | "service" | "affiliate"
    : "all";
  const [products, categories] = await Promise.all([getPublishedProducts(), getActiveCategories()]);
  const connected = isSupabaseConfigured();

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4"><BrandLogo /><MarketplaceSearch defaultValue={initialQuery} className="order-3 w-full sm:order-2 sm:ml-auto sm:w-[24rem]" /><Link href="/register" className="order-2 ml-auto rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white sm:order-3 sm:ml-0">Create account</Link></div></header>
    <PromotionalBanner placement="marketplace" />
    <section className="mx-auto max-w-6xl px-6 py-12"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Discover</p><h1 className="mt-2 text-4xl font-black tracking-tight">Products and services from independent sellers</h1><p className="mt-3 max-w-2xl text-slate-600">Every listing is published from a Coursely AI seller store. Affiliate product offers include an approved source link and clear disclosure.</p><MarketplaceBrowser products={products} categories={categories} connected={connected} initialQuery={initialQuery} initialFilter={initialFilter} /><p className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>External product rule:</strong> Amazon, Flipkart, and other marketplace products can appear only through approved seller or affiliate feeds. Sellers cannot copy third-party catalogues, images, or descriptions without permission.</p></section>
  </main>;
}

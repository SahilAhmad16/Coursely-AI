"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { MarketplaceCategory } from "@/lib/data/marketplace";

type MarketplaceProduct = {
  id: string; title: string; slug: string; description: string; listingType: "digital" | "service" | "affiliate";
  pricePaise: number; currency: string; thumbnailUrl: string | null; storeName: string; stockQuantity: number | null;
  categoryId: string | null; categoryName: string | null;
};

const filters = [
  ["all", "All"], ["digital", "Digital products"], ["service", "Professional services"], ["affiliate", "Products"],
] as const;

function formatPrice(paise: number, currency: string) { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100); }

export function MarketplaceBrowser({ products, categories, connected, initialQuery = "", initialFilter = "all" }: { products: MarketplaceProduct[]; categories: MarketplaceCategory[]; connected: boolean; initialQuery?: string; initialFilter?: (typeof filters)[number][0] }) {
  const [filter, setFilter] = useState<(typeof filters)[number][0]>(initialFilter);
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState(initialQuery);
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => (filter === "all" || product.listingType === filter) && (categoryId === "all" || product.categoryId === categoryId) && (!normalizedQuery || `${product.title} ${product.description} ${product.storeName} ${product.categoryName ?? ""}`.toLowerCase().includes(normalizedQuery)));
  }, [categoryId, filter, products, query]);

  return <><div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-2">{filters.map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === value ? "bg-slate-950 text-white" : "border border-slate-300 bg-white hover:border-emerald-500 hover:text-emerald-700"}`}>{label}</button>)}</div>{categories.length > 0 && <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4"><button onClick={() => setCategoryId("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${categoryId === "all" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}>All categories</button>{categories.map((category) => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${categoryId === category.id ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}>{category.name}</button>)}</div>}<label className="sr-only" htmlFor="marketplace-search">Search marketplace</label><input id="marketplace-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or services" className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm sm:max-w-80" /></div>{products.length ? <><p className="mt-5 text-sm text-slate-500">{visibleProducts.length} matching listing{visibleProducts.length === 1 ? "" : "s"}</p>{visibleProducts.length ? <div className="mt-5 grid gap-6 md:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="relative grid h-44 place-items-center overflow-hidden bg-gradient-to-br from-emerald-100 to-sky-100 p-5">{product.thumbnailUrl && <Image src={product.thumbnailUrl} alt={product.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}<span className="relative rounded-full bg-white/90 px-3 py-1 text-xs font-bold capitalize">{product.listingType === "affiliate" ? "affiliate product" : product.listingType}</span></div><div className="p-5"><h2 className="font-bold">{product.title}</h2><p className="mt-1 text-sm text-slate-500">by {product.storeName}{product.categoryName ? ` · ${product.categoryName}` : ""}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.description}</p><div className="mt-5 flex items-center justify-between gap-3"><div><span className="font-black">{formatPrice(product.pricePaise, product.currency)}</span>{product.listingType === "affiliate" && <span className="mt-1 block text-xs text-slate-500">Price shown by partner; it may change</span>}</div><Link href={`/products/${product.slug}`} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">{product.listingType === "affiliate" ? "View offer" : "View"}</Link></div></div></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">No matching listings</h2><p className="mt-2 text-sm text-slate-600">Try another category or a different search term.</p><button onClick={() => { setFilter("all"); setCategoryId("all"); setQuery(""); }} className="mt-4 font-bold text-emerald-700">Clear filters</button></div>}</> : <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">{connected ? "No published listings yet" : "Marketplace connection in progress"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{connected ? "Listings unlock only after an account, seller application and verification." : "The marketplace will show live products as soon as the database setup is connected."}</p><Link href="/start" className="mt-5 inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Choose account path</Link></div>}</>;
}

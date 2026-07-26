type MarketplaceSearchProps = {
  defaultValue?: string;
  className?: string;
};

export function MarketplaceSearch({ defaultValue = "", className = "" }: MarketplaceSearchProps) {
  return <form action="/marketplace" method="get" role="search" className={`flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100 ${className}`}>
    <label className="sr-only" htmlFor="global-marketplace-search">Search Coursely AI marketplace</label>
    <input id="global-marketplace-search" name="q" type="search" defaultValue={defaultValue} maxLength={100} placeholder="Search products, digital items or services" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-slate-400" />
    <button type="submit" className="shrink-0 bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700">Search</button>
  </form>;
}

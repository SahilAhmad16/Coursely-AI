import "server-only";
import { readListingDetails, type ListingDetails } from "@/lib/listing-details";
import { createClient } from "@/lib/supabase/server";

export type MarketplaceProduct = {
  id: string;
  title: string;
  slug: string;
  description: string;
  listingType: "digital" | "service" | "affiliate";
  pricePaise: number;
  currency: string;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  storeName: string;
  storeSlug: string;
  externalSource: string | null;
  externalListingUrl: string | null;
  affiliateDisclosure: string | null;
  stockQuantity: number | null;
  serviceDeliveryDays: number | null;
  listingDetails: ListingDetails;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
};

export type MarketplaceCategory = { id: string; name: string; slug: string };
export type Storefront = { id: string; name: string; slug: string; description: string | null; isVerified: boolean; logoUrl: string | null; bannerUrl: string | null; products: MarketplaceProduct[] };

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function normalizeProduct(row: Record<string, unknown>): MarketplaceProduct {
  const store = Array.isArray(row.stores) ? row.stores[0] : row.stores;
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return {
    id: String(row.id), title: String(row.title), slug: String(row.slug), description: String(row.description ?? ""),
    listingType: row.listing_type as MarketplaceProduct["listingType"], pricePaise: Number(row.price_paise), currency: String(row.currency),
    thumbnailPath: typeof row.thumbnail_path === "string" ? row.thumbnail_path : null,
    thumbnailUrl: null,
    storeName: typeof store === "object" && store && "name" in store ? String(store.name) : "Coursely seller",
    storeSlug: typeof store === "object" && store && "slug" in store ? String(store.slug) : "seller",
    externalSource: typeof row.external_source === "string" ? row.external_source : null,
    externalListingUrl: typeof row.external_listing_url === "string" ? row.external_listing_url : null,
    affiliateDisclosure: typeof row.affiliate_disclosure === "string" ? row.affiliate_disclosure : null,
    stockQuantity: typeof row.stock_quantity === "number" ? row.stock_quantity : null,
    serviceDeliveryDays: typeof row.service_delivery_days === "number" ? row.service_delivery_days : null,
    listingDetails: readListingDetails(row.listing_details),
    categoryId: typeof row.category_id === "string" ? row.category_id : null,
    categoryName: typeof category === "object" && category && "name" in category ? String(category.name) : null,
    categorySlug: typeof category === "object" && category && "slug" in category ? String(category.slug) : null,
  };
}

const productSelect = "id,title,slug,description,listing_type,price_paise,currency,thumbnail_path,stock_quantity,service_delivery_days,external_source,external_listing_url,affiliate_disclosure,listing_details,category_id,stores(name,slug),categories(name,slug)";

function reportMarketplaceQueryFailure(error: { code?: string; message?: string }) {
  const code = error.code || "network_unavailable";
  const message = error.message || "Unable to reach the marketplace database.";

  // A temporary database/network outage should not trigger Next.js' red
  // development overlay. The marketplace already has a valid empty state.
  console.warn(`[Coursely AI] Marketplace data unavailable (${code}): ${message}`);
}

export async function getActiveCategories() {
  if (!isSupabaseConfigured()) return [] as MarketplaceCategory[];
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("id,name,slug").eq("is_active", true).order("name");
  if (error) return [] as MarketplaceCategory[];
  return (data ?? []) as MarketplaceCategory[];
}

export async function getPublishedProducts(limit = 24) {
  if (!isSupabaseConfigured()) return [] as MarketplaceProduct[];
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(productSelect).eq("status", "published").in("listing_type", ["digital", "service", "affiliate"]).order("created_at", { ascending: false }).limit(limit);
  if (error) {
    reportMarketplaceQueryFailure(error);
    return [] as MarketplaceProduct[];
  }
  return attachSignedThumbnails((data as Record<string, unknown>[]).map(normalizeProduct), supabase);
}

export async function getProductBySlug(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(productSelect).eq("slug", slug).eq("status", "published").in("listing_type", ["digital", "service", "affiliate"]).maybeSingle();
  if (error) {
    reportMarketplaceQueryFailure(error);
    return null;
  }
  return data ? (await attachSignedThumbnails([normalizeProduct(data as Record<string, unknown>)], supabase))[0] : null;
}

export async function getStorefront(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: store, error } = await supabase.from("stores").select("id,name,slug,description,is_verified,logo_path,banner_path").eq("slug", slug).maybeSingle();
  if (error || !store) return null;
  const { data: rows } = await supabase.from("products").select(productSelect).eq("store_id", store.id).eq("status", "published").in("listing_type", ["digital", "service", "affiliate"]).order("created_at", { ascending: false });
  const [products, logo, banner] = await Promise.all([
    attachSignedThumbnails((rows ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)), supabase),
    signedStoreAsset(store.logo_path, supabase),
    signedStoreAsset(store.banner_path, supabase),
  ]);
  return { id: store.id, name: store.name, slug: store.slug, description: store.description, isVerified: store.is_verified, logoUrl: logo, bannerUrl: banner, products } satisfies Storefront;
}

async function attachSignedThumbnails(products: MarketplaceProduct[], supabase: Awaited<ReturnType<typeof createClient>>) {
  return Promise.all(products.map(async (product) => {
    if (!product.thumbnailPath) return product;
    const { data } = await supabase.storage.from("product-media").createSignedUrl(product.thumbnailPath, 60 * 30);
    return { ...product, thumbnailUrl: data?.signedUrl ?? null };
  }));
}

async function signedStoreAsset(path: string | null, supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!path) return null;
  const { data } = await supabase.storage.from("store-assets").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export function formatPrice(paise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);
}

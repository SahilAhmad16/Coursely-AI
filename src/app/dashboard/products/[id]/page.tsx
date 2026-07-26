import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductEditor } from "@/components/product-editor";
import { ServiceSellerLocked } from "@/components/service-seller-locked";
import { readListingDetails } from "@/lib/listing-details";
import { getStoreSellerAccess } from "@/lib/service-seller-plan";
import { isSupabaseConfigured } from "@/lib/data/marketplace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductQuery = {
  id: string;
  store_id: string;
  title: string;
  description: string;
  listing_type: "digital" | "service" | "affiliate";
  price_paise: number;
  stock_quantity: number | null;
  service_delivery_days: number | null;
  external_source: string | null;
  external_listing_url: string | null;
  affiliate_disclosure: string | null;
  listing_details: unknown;
  digital_file_name: string | null;
  status: string;
  product_media: { id: string; path: string; alt_text: string | null; position: number }[] | null;
};

export default async function ProductManagementPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase
    .from("products")
    .select("id,store_id,title,description,listing_type,price_paise,stock_quantity,service_delivery_days,external_source,external_listing_url,affiliate_disclosure,listing_details,digital_file_name,status,product_media(id,path,alt_text,position),stores!inner(owner_id)")
    .eq("id", id)
    .eq("stores.owner_id", user.id)
    .maybeSingle();
  if (error || !data) notFound();
  const product = data as ProductQuery;
  const sellerAccess = await getStoreSellerAccess(supabase, product.store_id);
  if (sellerAccess.isLocked) return <ServiceSellerLocked subscriptions={sellerAccess.lockedPlans} />;
  const media = (product.product_media ?? []).sort((a, b) => a.position - b.position);

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><Link href="/dashboard" className="text-sm font-semibold">Back to dashboard</Link></div></header>
      <div className="mx-auto max-w-6xl px-6 py-10"><ProductEditor product={{ id: product.id, title: product.title, description: product.description, listingType: product.listing_type, pricePaise: product.price_paise, stockQuantity: product.stock_quantity, serviceDeliveryDays: product.service_delivery_days, externalSource: product.external_source, externalListingUrl: product.external_listing_url, affiliateDisclosure: product.affiliate_disclosure, listingDetails: readListingDetails(product.listing_details), digitalFileName: product.digital_file_name, status: product.status }} media={media.map((item) => ({ id: item.id, path: item.path, altText: item.alt_text }))} /></div>
    </main>
  );
}

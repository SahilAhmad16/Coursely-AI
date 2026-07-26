import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice, getProductBySlug } from "@/lib/data/marketplace";
import { AddToCartButton } from "@/components/add-to-cart";
import { ContactSeller } from "@/components/contact-seller";
import { ReportListingButton } from "@/components/report-listing-button";
import { WishlistButton } from "@/components/wishlist-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: wishlist }, { data: reviews }] = await Promise.all([
    user ? supabase.from("wishlists").select("product_id").eq("user_id", user.id).eq("product_id", product.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("reviews").select("id,rating,body,created_at,profiles(full_name)").eq("product_id", product.id).order("created_at", { ascending: false }),
  ]);
  const isAffiliate = product.listingType === "affiliate";
  return <main className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><div className="flex items-center gap-4"><Link href="/account" className="text-sm font-semibold">Account</Link><Link href="/cart" className="text-sm font-semibold">Cart</Link><Link href="/marketplace" className="text-sm font-semibold">Back to marketplace</Link></div></div></header><section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.1fr_.9fr]"><div className="relative min-h-80 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-100 via-sky-100 to-violet-100">{product.thumbnailUrl && <Image src={product.thumbnailUrl} alt={product.title} fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />}</div><div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold capitalize text-emerald-800">{isAffiliate ? "affiliate product" : product.listingType}</span><h1 className="mt-5 text-4xl font-black tracking-tight">{product.title}</h1><p className="mt-3 text-sm font-semibold text-slate-500">{isAffiliate && product.externalSource ? `Partner source: ${product.externalSource}` : <>Sold by <Link className="text-emerald-700 hover:underline" href={`/stores/${product.storeSlug}`}>{product.storeName}</Link></>}</p>{product.categoryName && <p className="mt-2 text-sm font-semibold text-slate-500">Category: {product.categoryName}</p>}{product.listingType === "service" && product.serviceDeliveryDays && <p className="mt-3 inline-flex rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-800">Estimated delivery: {product.serviceDeliveryDays} day{product.serviceDeliveryDays === 1 ? "" : "s"}</p>}<p className="mt-6 whitespace-pre-wrap leading-7 text-slate-700">{product.description}</p><ListingDetails product={product} /><div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">{isAffiliate ? <AffiliateOffer href={product.externalListingUrl} disclosure={product.affiliateDisclosure} /> : <><p className="text-2xl font-black">{formatPrice(product.pricePaise, product.currency)}</p><AddToCartButton product={product} available />{product.listingType === "service" && <ContactSeller productId={product.id} />}<WishlistButton productId={product.id} initiallySaved={Boolean(wishlist)} /><p className="mt-3 text-center text-xs leading-5 text-slate-500">Checkout and payment confirmation are shown before any charge is made.</p></>}<ReportListingButton productId={product.id} /></div></div></section><Reviews reviews={reviews ?? []} /></main>;
}

function Reviews({ reviews }: { reviews: { id: string; rating: number; body: string | null; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null }[] }) {
  return <section className="mx-auto max-w-6xl px-6 pb-16"><div className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Customer reviews</p><h2 className="mt-1 text-2xl font-black">What verified buyers say</h2></div><p className="text-sm text-slate-500">Reviews can be added after a fulfilled, verified order.</p></div>{reviews.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{reviews.map((review) => { const profile = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles; return <article key={review.id} className="rounded-xl bg-slate-50 p-4"><p className="font-black text-amber-500">{"★".repeat(review.rating)}<span className="text-slate-300">{"★".repeat(5 - review.rating)}</span></p><p className="mt-3 text-sm leading-6 text-slate-700">{review.body || "No written review provided."}</p><p className="mt-3 text-xs font-semibold text-slate-500">{profile?.full_name || "Verified buyer"} · {new Date(review.created_at).toLocaleDateString("en-IN")}</p></article>; })}</div> : <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No reviews yet. Verified customer reviews will appear here.</p>}</div></section>;
}

function ListingDetails({ product }: { product: Awaited<ReturnType<typeof getProductBySlug>> & {} }) {
  if (!product || product.listingType === "affiliate") return null;
  const details = product.listingDetails;
  const items = product.listingType === "digital" ? [["Includes", details.digitalIncluded], ["Format", details.digitalFormat], ["License", details.digitalLicense]] : [["Deliverables", details.serviceScope], ["Revisions", details.serviceRevisions ? `${details.serviceRevisions} included` : undefined]];
  const visible = items.filter((item): item is [string, string] => Boolean(item[1]));
  if (!visible.length) return null;
  return <dl className="mt-7 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">{visible.map(([label, value]) => <div key={label}><dt className="font-bold text-slate-950">{label}</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{value}</dd></div>)}</dl>;
}

function AffiliateOffer({ href, disclosure }: { href: string | null; disclosure: string | null }) {
  if (!href) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This partner offer is temporarily unavailable because its approved link is missing.</p>;
  return <><p className="text-lg font-black">Continue with partner</p><p className="mt-2 text-sm leading-6 text-slate-600">This offer is fulfilled by the linked partner, not by Coursely AI. Their delivery, return, and payment rules apply.</p><a href={href} target="_blank" rel="nofollow sponsored noopener noreferrer" className="mt-5 block rounded-xl bg-slate-950 py-3 text-center font-bold text-white transition hover:bg-emerald-700">View partner offer ↗</a><p className="mt-3 text-xs leading-5 text-slate-500">{disclosure || "Coursely AI may receive a commission if you buy through this approved partner link."}</p></>;
}

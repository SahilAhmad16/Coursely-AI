"use client";

import { useActionState, useState } from "react";
import { updateListing } from "@/app/actions/listings";
import { DigitalFileUploader } from "@/components/digital-file-uploader";
import { ListingDetailsFields } from "@/components/listing-details-fields";
import { MediaUploader } from "@/components/media-uploader";
import type { ListingDetails, ListingType } from "@/lib/listing-details";

type ProductEditorProps = {
  product: {
    id: string;
    title: string;
    description: string;
    listingType: ListingType;
    pricePaise: number;
    stockQuantity: number | null;
    serviceDeliveryDays: number | null;
    externalSource: string | null;
    externalListingUrl: string | null;
    affiliateDisclosure: string | null;
    listingDetails: ListingDetails;
    digitalFileName: string | null;
    status: string;
  };
  media: { id: string; path: string; altText: string | null }[];
};

export function ProductEditor({ product, media }: ProductEditorProps) {
  const [state, action, pending] = useActionState(updateListing, {});
  const [listingType, setListingType] = useState<ListingType>(product.listingType);

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"><form action={action} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm"><input type="hidden" name="productId" value={product.id} /><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Listing editor</p><h1 className="mt-1 text-3xl font-black">{product.title}</h1></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold capitalize text-amber-800">{product.status.replace("_", " ")}</span></div><label className="block text-sm font-bold">Listing title<input name="title" defaultValue={product.title} minLength={4} maxLength={120} required className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold">Listing type<select name="listingType" value={listingType} onChange={(event) => setListingType(event.target.value as ListingType)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal"><option value="digital">Digital product</option><option value="service">Professional service</option><option value="affiliate">Product affiliate offer</option></select></label><label className="block text-sm font-bold">{listingType === "affiliate" ? "Price shown on partner site (INR)" : "Price (INR)"}<input name="price" type="number" min="0" max="10000000" step="1" defaultValue={product.pricePaise / 100} required className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label></div><label className="block text-sm font-bold">Description<textarea name="description" defaultValue={product.description} minLength={20} maxLength={5000} required className="mt-2 min-h-36 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>{listingType === "service" && <label className="block text-sm font-bold">Service delivery days<input name="serviceDeliveryDays" type="number" min="1" max="365" step="1" defaultValue={product.serviceDeliveryDays ?? ""} required className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>}<ListingDetailsFields listingType={listingType} details={product.listingDetails} />{listingType === "affiliate" && <AffiliateFields product={product} />}{state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{state.error}</p>}{state.success && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{state.success}</p>}<div className="flex flex-wrap gap-3"><button name="intent" value="save" disabled={pending} className="rounded-xl border border-slate-300 px-5 py-3 font-bold disabled:opacity-50">{pending ? "Saving..." : "Save changes"}</button><button name="intent" value="submit" disabled={pending} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">Save & submit for review</button></div></form><aside className="h-fit space-y-6"><section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Cover, thumbnail & previews</h2><p className="mt-2 text-sm leading-6 text-slate-600">The first uploaded image becomes this listing’s cover and thumbnail. Add more images for previews. At least one image is required before review.</p><MediaUploader productId={product.id} />{media.length ? <div className="mt-5 space-y-2"><p className="text-sm font-bold">Attached images ({media.length})</p>{media.map((item, index) => <div key={item.id} className="rounded-lg bg-slate-100 p-3 text-xs text-slate-600"><span className="font-bold text-slate-800">{index === 0 ? "Cover & thumbnail" : `Preview image ${index + 1}`}</span><br />{item.altText || "No description added"}</div>)}</div> : <p className="mt-5 text-sm font-semibold text-amber-800">No product images yet.</p>}</section>{listingType === "digital" && <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Digital delivery asset</h2><p className="mt-2 text-sm leading-6 text-slate-600">Attach the actual file here. It is private and never shown publicly.</p><DigitalFileUploader productId={product.id} fileName={product.digitalFileName} /></section>}</aside></div>;
}

function AffiliateFields({ product }: { product: ProductEditorProps["product"] }) {
  return <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5"><h2 className="font-black text-amber-950">Approved affiliate details</h2><p className="mt-1 text-sm text-amber-900/70">Use only official, approved sources and provide a clear disclosure to the buyer.</p><div className="mt-4 grid gap-4"><Field label="Approved affiliate source" name="externalSource" defaultValue={product.externalSource ?? ""} placeholder="Source, e.g. Amazon Associates" required /><Field label="Official affiliate link" name="externalListingUrl" type="url" defaultValue={product.externalListingUrl ?? ""} placeholder="https://approved-source.example/product" required /><label className="block text-sm font-bold">Buyer disclosure<textarea name="affiliateDisclosure" defaultValue={product.affiliateDisclosure ?? ""} required minLength={12} className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="I may earn a commission if you buy through this link." /></label></div></section>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-sm font-bold">{label}<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" {...props} /></label>;
}

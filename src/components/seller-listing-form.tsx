"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createListing } from "@/app/actions/listings";
import { ListingDetailsFields } from "@/components/listing-details-fields";
import type { ListingType } from "@/lib/listing-details";
import type { MarketplaceCategory } from "@/lib/data/marketplace";

type SellerPath = ListingType;

const paths: { value: SellerPath; title: string; detail: string; icon: string }[] = [
  { value: "affiliate", icon: "01", title: "Products", detail: "Share an approved affiliate product. The partner handles payment, delivery and returns." },
  { value: "service", icon: "02", title: "Professional service", detail: "Sell video editing, design, development, consulting and more." },
  { value: "digital", icon: "03", title: "Digital product", detail: "Sell templates, ebooks, files, courses and downloadable assets." },
];

const content = {
  digital: { title: "Name your digital product", placeholder: "Example: Instagram Reel Editing Template Pack", description: "Explain what the buyer will receive and how they can use it." },
  service: { title: "Name your service", placeholder: "Example: 60-second video editing service", description: "Explain your scope, deliverables and requirements from the customer." },
  affiliate: { title: "Name the approved partner offer", placeholder: "Example: Wireless keyboard — verified partner offer", description: "Use only an official affiliate link and a clear buyer disclosure." },
};

export function SellerListingForm({ categories }: { categories: MarketplaceCategory[] }) {
  const router = useRouter();
  const [listingType, setListingType] = useState<ListingType>("digital");
  const [state, action, pending] = useActionState(createListing, {});
  const copy = content[listingType];

  useEffect(() => {
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [router, state.redirectTo]);

  return <form action={action} className="mt-8 space-y-7"><input type="hidden" name="listingType" value={listingType} /><section><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-black">1. Pick a seller path</h2><p className="text-sm text-slate-500">You can create different listing types later too.</p></div><div className="mt-4 grid gap-4 md:grid-cols-3">{paths.map((path) => <button key={path.value} type="button" onClick={() => setListingType(path.value)} className={`group rounded-2xl border p-5 text-left transition ${listingType === path.value ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-900/5" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"}`}><span className={`grid size-9 place-items-center rounded-xl text-xs font-black ${listingType === path.value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>{path.icon}</span><h3 className="mt-5 font-black">{path.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{path.detail}</p></button>)}</div></section><section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">2. Listing information</p><h2 className="mt-1 text-2xl font-black">{copy.title}</h2></div><Field label="Listing title" name="title" placeholder={copy.placeholder} required /><div className="grid gap-5 sm:grid-cols-2"><Field label={listingType === "affiliate" ? "Price shown on partner site (INR)" : "Price (INR)"} name="price" placeholder="1499" type="number" min="0" max="10000000" required />{listingType === "service" && <Field label="Service delivery days" name="serviceDeliveryDays" placeholder="3" type="number" min="1" max="365" required />}</div><label className="block text-sm font-bold">Category<select name="categoryId" defaultValue="" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" required><option value="" disabled>Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block text-sm font-bold">Full description<textarea name="description" required minLength={20} maxLength={5000} className="mt-2 min-h-36 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder={copy.description} /></label><ListingDetailsFields listingType={listingType} />{listingType === "affiliate" && <AffiliateFields />}<PlanNotice listingType={listingType} /><section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"><h2 className="font-black">3. Cover, thumbnail and files</h2><p className="mt-2 text-sm leading-6 text-slate-600">Save this draft first. The next screen lets you upload the main cover/thumbnail and extra preview images. Digital products also get a separate private delivery-file upload.</p></section>{state.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{state.error}</p>}{state.success && !state.redirectTo && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{state.success}</p>}<button disabled={pending} className="w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{pending ? "Creating your draft..." : "Save draft and continue to uploads"}</button></section></form>;
}

function PlanNotice({ listingType }: { listingType: ListingType }) {
  const text = listingType === "service" ? "First 28 days are free. After that, the Service seller plan is ₹50 per 28 days. Services do not have a platform sale commission." : listingType === "digital" ? "First 28 days are free. After that, the Digital seller plan is ₹60 per 28 days. Confirmed Coursely AI digital sales have a 10% platform commission." : "First 28 days are free. After that, the Product affiliate seller plan is ₹50 per 28 days. The partner platform handles the sale and pays affiliate earnings directly; Coursely AI does not deduct a sale commission.";
  return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Platform fee:</strong> {text}</p>;
}

function AffiliateFields() {
  return <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5"><h2 className="font-black text-amber-950">Approved affiliate details</h2><p className="mt-1 text-sm text-amber-900/70">Do not copy another platform’s catalogue, images, or description without permission.</p><div className="mt-4 grid gap-4"><Field label="Approved affiliate source" name="externalSource" placeholder="Example: Amazon Associates" required /><Field label="Official affiliate link" name="externalListingUrl" placeholder="https://…" type="url" required /><label className="block text-sm font-bold">Buyer disclosure<textarea name="affiliateDisclosure" required minLength={12} maxLength={600} className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" placeholder="I may earn a commission if you buy through this link." /></label></div></section>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-sm font-bold">{label}<input className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" {...props} /></label>;
}

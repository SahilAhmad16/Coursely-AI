import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerListingForm } from "@/components/seller-listing-form";
import { ServiceSellerLocked } from "@/components/service-seller-locked";
import { getCurrentUserSellerAccess } from "@/lib/service-seller-plan";
import { getActiveCategories } from "@/lib/data/marketplace";
import { createClient } from "@/lib/supabase/server";

export default async function SellPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/register");
  const { data: store } = await supabase
    .from("stores")
    .select("id,is_verified")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store || !store.is_verified) redirect("/dashboard?setup=seller");
  const access = await getCurrentUserSellerAccess(supabase, user.id);
  if (access.isLocked) return <ServiceSellerLocked subscriptions={access.lockedPlans} />;
  const categories = await getActiveCategories();
  return <main className="min-h-screen bg-slate-50"><header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><Link href="/" className="font-black">Coursely AI</Link><Link href="/dashboard" className="text-sm font-semibold">Seller dashboard</Link></header><section className="mx-auto max-w-5xl px-6 py-10"><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Seller studio</p><h1 className="mt-2 text-4xl font-black tracking-tight">Choose what you want to sell</h1><p className="mt-3 max-w-2xl text-slate-600">Start with the right seller path. Coursely AI only asks for the information your product or service needs.</p><SellerListingForm categories={categories} /></section></main>;
}

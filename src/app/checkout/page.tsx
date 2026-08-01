import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout-view";
import { isCashfreeConfigured } from "@/lib/cashfree";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/checkout");
  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
  return <CheckoutView defaultPhone={profile?.phone ?? ""} configured={isCashfreeConfigured()} />;
}

import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout-view";
import { createClient } from "@/lib/supabase/server";

export default async function CheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/checkout");
  return <CheckoutView />;
}

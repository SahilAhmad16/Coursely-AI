"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const categories = new Set(["account", "seller", "listing", "payment", "digital_delivery", "service", "affiliate", "other"]);

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function createSupportTicket(formData: FormData) {
  const category = field(formData, "category");
  const subject = field(formData, "subject");
  const message = field(formData, "message");
  if (!categories.has(category) || subject.length < 5 || subject.length > 140 || message.length < 20 || message.length > 4000) {
    redirect("/support?error=invalid");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/support");
  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    category,
    subject,
    message,
  });
  if (error) redirect("/support?error=save");
  revalidatePath("/support");
  revalidatePath("/admin");
  redirect("/support?created=1");
}

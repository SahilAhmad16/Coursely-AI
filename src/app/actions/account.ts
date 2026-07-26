"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await currentUser();
  const fullName = text(formData, "fullName");
  const username = text(formData, "username").toLowerCase();
  const phone = text(formData, "phone");
  const bio = text(formData, "bio");
  if (fullName.length < 2 || fullName.length > 120) redirect("/account?error=profile");
  if (username && !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) redirect("/account?error=username");
  if (phone.length > 20 || bio.length > 500) redirect("/account?error=profile");
  const { error } = await supabase.from("profiles").update({ full_name: fullName, username: username || null, phone: phone || null, bio }).eq("id", user.id);
  if (error) redirect(`/account?error=${error.code === "23505" ? "username" : "profile"}`);
  revalidatePath("/account");
  redirect("/account?updated=profile");
}

export async function saveAddress(formData: FormData) {
  const { supabase, user } = await currentUser();
  const values = {
    label: text(formData, "label"), recipient_name: text(formData, "recipientName"), phone: text(formData, "phone"),
    line1: text(formData, "line1"), line2: text(formData, "line2") || null, city: text(formData, "city"), state: text(formData, "state"),
    postal_code: text(formData, "postalCode"), country_code: "IN", is_default: formData.get("isDefault") === "on",
  };
  if (!values.label || !values.recipient_name || !values.phone || !values.line1 || !values.city || !values.state || !values.postal_code) redirect("/account?error=address");
  if (values.is_default) await supabase.from("saved_addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("saved_addresses").insert({ user_id: user.id, ...values });
  if (error) redirect("/account?error=address");
  revalidatePath("/account");
  redirect("/account?updated=address");
}

export async function setDefaultAddress(formData: FormData) {
  const { supabase, user } = await currentUser();
  const id = text(formData, "addressId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/account?error=address");
  await supabase.from("saved_addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("saved_addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  if (error) redirect("/account?error=address");
  revalidatePath("/account");
  redirect("/account?updated=address");
}

export async function deleteAddress(formData: FormData) {
  const { supabase, user } = await currentUser();
  const id = text(formData, "addressId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/account?error=address");
  await supabase.from("saved_addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
  redirect("/account?updated=address");
}

export async function markNotificationRead(formData: FormData) {
  const { supabase, user } = await currentUser();
  const id = text(formData, "notificationId");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/account");
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
  redirect("/account?updated=notification");
}

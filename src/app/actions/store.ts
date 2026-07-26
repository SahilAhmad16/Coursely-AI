"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStoreSellerAccess } from "@/lib/service-seller-plan";
import { createClient } from "@/lib/supabase/server";

export type StoreSettingsResult = { error?: string; success?: string };
export type StoreAssetResult = { error?: string; success?: string; replacedPath?: string | null };
export type SellerStoreApplicationResult = { error?: string };

function field(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function toSlug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export async function createSellerStore(_: SellerStoreApplicationResult, formData: FormData): Promise<SellerStoreApplicationResult> {
  const name = field(formData, "storeName");
  const slug = toSlug(field(formData, "storeSlug"));
  const description = field(formData, "storeDescription");
  if (name.length < 2 || name.length > 80) return { error: "Store name must be 2 to 80 characters." };
  if (slug.length < 3 || slug.length > 60) return { error: "Store URL must contain 3 to 60 letters, numbers, or hyphens." };
  if (description.length > 500) return { error: "Store introduction can be at most 500 characters." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Create or sign in to your account before applying as a seller." };
  const { data: existing } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
  if (existing) redirect("/dashboard?setup=seller");

  const { error } = await supabase.from("stores").insert({ owner_id: user.id, name, slug, description: description || null });
  if (error) return { error: error.code === "23505" ? "That store URL is already in use. Choose another one." : "Your seller store could not be created. Please try again." };
  revalidatePath("/dashboard");
  redirect("/dashboard?setup=verification");
}

export async function updateStoreSettings(_: StoreSettingsResult, formData: FormData): Promise<StoreSettingsResult> {
  const storeId = field(formData, "storeId");
  const name = field(formData, "name");
  const description = field(formData, "description");
  const slug = toSlug(field(formData, "slug"));
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return { error: "Store not found." };
  if (name.length < 2 || name.length > 80) return { error: "Store name must be 2 to 80 characters." };
  if (slug.length < 3 || slug.length > 60) return { error: "Store URL must contain 3 to 60 letters, numbers, or hyphens." };
  if (description.length > 500) return { error: "Store description can be at most 500 characters." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  const access = await getStoreSellerAccess(supabase, storeId);
  if (access.isLocked) return { error: "Your seller account is locked until the required 28-day plan is renewed." };
  const { error } = await supabase.from("stores").update({ name, slug, description: description || null }).eq("id", storeId).eq("owner_id", user.id);
  if (error) return { error: error.code === "23505" ? "That store URL is already in use. Choose another one." : "Store settings could not be saved. Please try again." };
  revalidatePath("/dashboard");
  revalidatePath("/marketplace");
  return { success: "Store settings saved." };
}

export async function attachStoreAsset(storeId: string, kind: "logo" | "banner", path: string): Promise<StoreAssetResult> {
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !["logo", "banner"].includes(kind)) return { error: "Invalid store asset." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (!path.startsWith(`${user.id}/${storeId}/${kind}/`) || path.includes("..")) return { error: "Invalid upload path." };
  const access = await getStoreSellerAccess(supabase, storeId);
  if (access.isLocked) return { error: "Your seller account is locked until the required 28-day plan is renewed." };
  const fieldName = kind === "logo" ? "logo_path" : "banner_path";
  const { data: store, error: readError } = await supabase.from("stores").select("logo_path,banner_path,slug").eq("id", storeId).eq("owner_id", user.id).maybeSingle();
  if (readError || !store) return { error: "Store not found." };
  const { error } = await supabase.from("stores").update({ [fieldName]: path }).eq("id", storeId).eq("owner_id", user.id);
  if (error) return { error: "Store image could not be saved." };
  revalidatePath("/dashboard");
  revalidatePath(`/stores/${store.slug}`);
  return { success: `${kind === "logo" ? "Store logo" : "Store banner"} saved.`, replacedPath: kind === "logo" ? store.logo_path : store.banner_path };
}

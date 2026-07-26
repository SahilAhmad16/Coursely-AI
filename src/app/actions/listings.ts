"use server";

import { revalidatePath } from "next/cache";
import type { ListingDetails } from "@/lib/listing-details";
import { getStoreListingPlanAccess, getStoreSellerAccess, planPriceLabel } from "@/lib/service-seller-plan";
import { createClient } from "@/lib/supabase/server";

export type ListingResult = { error?: string; success?: string; redirectTo?: string; replacedPath?: string | null };

const listingTypes = new Set(["digital", "service", "affiliate"]);

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalNumber(formData: FormData, name: string) {
  const value = field(formData, name);
  return value ? Number(value) : null;
}

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function externalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function listingValues(formData: FormData): ListingResult & { values?: Record<string, unknown> } {
  const title = field(formData, "title");
  const description = field(formData, "description");
  const listingType = field(formData, "listingType");
  const price = Number(field(formData, "price"));
  const serviceDeliveryDays = optionalNumber(formData, "serviceDeliveryDays");
  const source = field(formData, "externalSource");
  const listingUrl = field(formData, "externalListingUrl");
  const disclosure = field(formData, "affiliateDisclosure");
  const details: ListingDetails = {};

  if (title.length < 4 || title.length > 120) return { error: "Title must be 4–120 characters." };
  if (description.length < 20) return { error: "Write at least 20 characters describing the listing." };
  if (!listingTypes.has(listingType)) return { error: "Choose a valid listing type." };
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: "Enter a valid price in rupees." };
  if (listingType === "service") {
    const scope = field(formData, "serviceScope");
    const revisions = optionalNumber(formData, "serviceRevisions");
    if (!Number.isInteger(serviceDeliveryDays) || serviceDeliveryDays! < 1 || serviceDeliveryDays! > 365) return { error: "Services need a delivery time between 1 and 365 days." };
    if (scope.length < 10 || scope.length > 1200) return { error: "Describe the service scope and deliverables in at least 10 characters." };
    if (!Number.isInteger(revisions) || revisions! < 0 || revisions! > 20) return { error: "Service revisions must be a whole number between 0 and 20." };
    details.serviceScope = scope;
    details.serviceRevisions = String(revisions);
  }
  if (listingType === "digital") {
    const included = field(formData, "digitalIncluded");
    const format = field(formData, "digitalFormat");
    const license = field(formData, "digitalLicense");
    if (included.length < 10 || included.length > 1200) return { error: "Explain what the digital buyer receives in at least 10 characters." };
    if (format.length < 2 || format.length > 120) return { error: "Enter the digital file format or access type." };
    if (license.length < 2 || license.length > 240) return { error: "Enter the digital product license or usage rights." };
    details.digitalIncluded = included;
    details.digitalFormat = format;
    details.digitalLicense = license;
  }
  if (listingType === "affiliate") {
    if (source.length < 2) return { error: "Enter the approved affiliate source." };
    if (!externalUrl(listingUrl)) return { error: "Affiliate listings need a valid https source link." };
    if (disclosure.length < 12) return { error: "Add a clear affiliate disclosure for buyers." };
  }

  return {
    values: {
      title,
      description,
      listing_type: listingType,
      price_paise: Math.round(price * 100),
      stock_quantity: null,
      service_delivery_days: listingType === "service" ? serviceDeliveryDays : null,
      requires_shipping: false,
      external_source: listingType === "affiliate" ? source : null,
      external_listing_url: listingType === "affiliate" ? externalUrl(listingUrl) : null,
      affiliate_disclosure: listingType === "affiliate" ? disclosure : null,
      listing_details: details,
    },
  };
}

export async function createListing(_: ListingResult, formData: FormData): Promise<ListingResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure seller service." };
  const result = listingValues(formData);
  if (!result.values) return result;
  const categoryId = field(formData, "categoryId") || null;
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Please log in before creating a listing." };

  const { data: existingStore, error: storeLookupError } = await supabase
    .from("stores").select("id,is_verified").eq("owner_id", user.id).maybeSingle();
  if (storeLookupError) return { error: "We could not load your store. Please try again." };
  if (existingStore) {
    if (!existingStore.is_verified) return { error: "Your seller verification must be approved before you can create a listing." };
    const access = await getStoreSellerAccess(supabase, existingStore.id);
    if (access.isLocked) return { error: "Your seller account is locked until the required 28-day plan is renewed." };
  }

  const storeId = existingStore?.id;
  if (!storeId) return { error: "Complete your seller store application and verification before creating a listing." };

  const uniqueSlug = `${toSlug(String(result.values.title))}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: listing, error: listingError } = await supabase.from("products").insert({
    ...result.values,
    store_id: storeId,
    category_id: categoryId,
    slug: uniqueSlug,
    status: "draft",
  }).select("id").single();
  if (listingError || !listing) return { error: "Your listing could not be saved. Check all fields and try again." };

  revalidatePath("/dashboard");
  return { success: "Draft saved.", redirectTo: `/dashboard/products/${listing.id}` };
}

export async function updateListing(_: ListingResult, formData: FormData): Promise<ListingResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure seller service." };
  const productId = field(formData, "productId");
  const result = listingValues(formData);
  if (!result.values) return result;
  const intent = field(formData, "intent") || "save";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in before editing a listing." };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,store_id,listing_type,digital_file_path,stores!inner(owner_id)")
    .eq("id", productId)
    .eq("stores.owner_id", user.id)
    .maybeSingle();
  if (productError || !product) return { error: "Listing not found or you do not have permission to edit it." };
  const sellerAccess = await getStoreSellerAccess(supabase, product.store_id);
  if (sellerAccess.isLocked) return { error: "Your seller account is locked until the required 28-day plan is renewed." };

  if (intent === "submit") {
    const { data: verification } = await supabase
      .from("seller_verifications")
      .select("status")
      .eq("seller_id", user.id)
      .maybeSingle();
    if (verification?.status !== "approved") return { error: "Submit your seller verification from the dashboard and wait for admin approval before sending listings for review." };
    const { count, error: mediaError } = await supabase
      .from("product_media")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (mediaError || !count) return { error: "Upload at least one product image before submitting this listing." };
    if (result.values.listing_type === "digital" && !product.digital_file_path) return { error: "Upload the private digital delivery file before submitting this listing for review." };
    const plan = await getStoreListingPlanAccess(supabase, product.store_id, result.values.listing_type as "digital" | "service" | "affiliate");
    if (!plan.isActive) return { error: `${planPriceLabel(plan.planType)} is required before this listing can be reviewed. Every seller category receives one free first 28-day period.` };
  }

  const { error: updateError } = await supabase.from("products").update({
    ...result.values,
    ...(intent === "submit" ? { status: "pending_review" } : {}),
  }).eq("id", productId);
  if (updateError) return { error: "We could not save this listing. Please try again." };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath("/marketplace");
  return { success: intent === "submit" ? "Listing submitted for review. It will only be published after approval." : "Listing changes saved." };
}

export async function addProductMedia(productId: string, path: string, altText: string): Promise<ListingResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure seller service." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in before uploading media." };
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !path.startsWith(`${user.id}/${productId}/`) || path.includes("..")) {
    return { error: "Invalid media upload path." };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,store_id,thumbnail_path,stores!inner(owner_id)")
    .eq("id", productId)
    .eq("stores.owner_id", user.id)
    .maybeSingle();
  if (productError || !product) return { error: "Listing not found or you do not have permission to upload to it." };
  const sellerAccess = await getStoreSellerAccess(supabase, product.store_id);
  if (sellerAccess.isLocked) return { error: "Your seller account is locked until the required 28-day plan is renewed." };

  const { data: lastMedia, error: mediaLookupError } = await supabase
    .from("product_media")
    .select("position")
    .eq("product_id", productId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mediaLookupError) return { error: "We could not prepare the media upload." };
  const position = (lastMedia?.position ?? -1) + 1;
  const { error: insertError } = await supabase.from("product_media").insert({
    product_id: productId,
    path,
    alt_text: altText.slice(0, 160) || null,
    position,
  });
  if (insertError) return { error: "Image upload finished, but it could not be attached to this listing." };
  if (!product.thumbnail_path) {
    const { error: thumbnailError } = await supabase.from("products").update({ thumbnail_path: path }).eq("id", productId);
    if (thumbnailError) return { error: "Image uploaded, but the thumbnail could not be selected." };
  }

  revalidatePath(`/dashboard/products/${productId}`);
  return { success: "Product image uploaded." };
}

export async function attachDigitalFile(productId: string, path: string, fileName: string): Promise<ListingResult> {
  if (!isConfigured()) return { error: "Coursely AI is still connecting its secure seller service." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in before uploading a digital file." };
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !path.startsWith(`${user.id}/${productId}/`) || path.includes("..")) return { error: "Invalid digital file path." };
  if (!fileName || fileName.length > 160) return { error: "Enter a valid digital file name." };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,store_id,listing_type,digital_file_path,stores!inner(owner_id)")
    .eq("id", productId)
    .eq("stores.owner_id", user.id)
    .maybeSingle();
  if (productError || !product) return { error: "Listing not found or you do not have permission to upload to it." };
  if (product.listing_type !== "digital") return { error: "Only digital product listings can have a delivery file." };
  const sellerAccess = await getStoreSellerAccess(supabase, product.store_id);
  if (sellerAccess.isLocked) return { error: "Your seller account is locked until the required 28-day plan is renewed." };

  const { error: updateError } = await supabase.from("products").update({
    digital_file_path: path,
    digital_file_name: fileName,
  }).eq("id", productId);
  if (updateError) return { error: "The file uploaded, but it could not be attached to this listing." };
  revalidatePath(`/dashboard/products/${productId}`);
  return { success: "Private delivery file attached.", replacedPath: product.digital_file_path };
}

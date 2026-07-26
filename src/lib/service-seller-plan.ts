import "server-only";
import { createClient } from "@/lib/supabase/server";

export const SERVICE_PLAN_DAYS = 28;
export type SellerPlanType = "service" | "digital" | "physical";
export type ListingType = "service" | "digital" | "affiliate";

export const SELLER_PLANS: Record<SellerPlanType, { amountPaise: number; title: string; firstPeriodFree?: boolean }> = {
  service: { amountPaise: 5_000, title: "Service seller", firstPeriodFree: true },
  digital: { amountPaise: 6_000, title: "Digital seller", firstPeriodFree: true },
  physical: { amountPaise: 5_000, title: "Product affiliate seller", firstPeriodFree: true },
};

export type SellerPlanSubscription = {
  plan_type: SellerPlanType;
  status: "pending" | "active" | "past_due" | "cancelled";
  amount_paise: number;
  is_trial: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
};

export function planForListing(listingType: ListingType): SellerPlanType {
  return listingType === "affiliate" ? "physical" : listingType;
}

export function isSellerPlanActive(subscription: SellerPlanSubscription | null | undefined) {
  return subscription?.status === "active" && Boolean(subscription.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now());
}

export function planPriceLabel(planType: SellerPlanType) {
  return `₹${SELLER_PLANS[planType].amountPaise / 100} per ${SERVICE_PLAN_DAYS} days`;
}

export async function getStoreSellerAccess(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string) {
  const { data } = await supabase.from("platform_subscriptions").select("plan_type,status,amount_paise,is_trial,current_period_start,current_period_end").eq("store_id", storeId);
  const subscriptions = (data ?? []) as SellerPlanSubscription[];
  const lockedPlans = subscriptions.filter((subscription) => !isSellerPlanActive(subscription));
  return { subscriptions, lockedPlans, isLocked: lockedPlans.length > 0 };
}

export async function getStoreListingPlanAccess(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string, listingType: ListingType) {
  const planType = planForListing(listingType);
  const { data } = await supabase.from("platform_subscriptions").select("plan_type,status,amount_paise,is_trial,current_period_start,current_period_end").eq("store_id", storeId).eq("plan_type", planType).maybeSingle();
  const subscription = data as SellerPlanSubscription | null;
  return { planType, subscription, isActive: isSellerPlanActive(subscription) };
}

export async function getCurrentUserSellerAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", userId).maybeSingle();
  if (!store) return { storeId: null, subscriptions: [], lockedPlans: [], isLocked: false };
  return { storeId: store.id, ...(await getStoreSellerAccess(supabase, store.id)) };
}

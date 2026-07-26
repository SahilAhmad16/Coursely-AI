"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function isUuid(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

export async function reviewListing(formData: FormData) {
  const productId = field(formData, "productId");
  const decision = field(formData, "decision");
  if (!isUuid(productId) || !["published", "rejected"].includes(decision)) redirect("/admin");

  const { supabase, user } = await requireAdmin();
  const { data: listing } = await supabase
    .from("products")
    .select("id,title,store_id,stores(owner_id,is_verified,slug)")
    .eq("id", productId)
    .maybeSingle();
  if (!listing) redirect("/admin");

  const store = Array.isArray(listing.stores) ? listing.stores[0] : listing.stores;
  if (decision === "published" && !store?.is_verified) redirect("/admin");

  const { error } = await supabase
    .from("products")
    .update({ status: decision })
    .eq("id", productId)
    .eq("status", "pending_review");
  if (!error) {
    if (store?.owner_id) await supabase.from("notifications").insert({
      user_id: store.owner_id,
      kind: "listing",
      title: decision === "published" ? "Listing approved" : "Listing needs changes",
      body: decision === "published" ? `${listing.title} is now live in the marketplace.` : `${listing.title} was not approved. Update it and submit again.`,
      href: `/dashboard/products/${listing.id}`,
    });
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: `listing_${decision}`,
      resource_type: "product",
      resource_id: listing.id,
      details: { title: listing.title },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/marketplace");
  if (store?.slug) revalidatePath(`/stores/${store.slug}`);
  redirect("/admin");
}

export async function reviewSellerVerification(formData: FormData) {
  const verificationId = field(formData, "verificationId");
  const decision = field(formData, "decision");
  const note = field(formData, "note");
  if (!isUuid(verificationId) || !["approved", "changes_requested", "rejected"].includes(decision) || note.length > 1000) redirect("/admin");

  const { supabase, user } = await requireAdmin();
  const { data: verification } = await supabase
    .from("seller_verifications")
    .select("id,seller_id,store_id,legal_name,stores(name,slug)")
    .eq("id", verificationId)
    .eq("status", "submitted")
    .maybeSingle();
  if (!verification) redirect("/admin");

  const store = Array.isArray(verification.stores) ? verification.stores[0] : verification.stores;
  const adminNote = note || (decision === "approved" ? "Seller verification approved by Coursely AI." : "Please update your verification details and submit again.");
  const { error } = await supabase.from("seller_verifications").update({
    status: decision,
    review_note: adminNote,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  }).eq("id", verification.id).eq("status", "submitted");

  if (!error) {
    await supabase.from("stores").update({ is_verified: decision === "approved" }).eq("id", verification.store_id);
    await supabase.from("notifications").insert({
      user_id: verification.seller_id,
      kind: "account",
      title: decision === "approved" ? "Seller verification approved" : decision === "changes_requested" ? "Seller verification needs changes" : "Seller verification was not approved",
      body: decision === "approved" ? "Your store is verified. You can now submit listings for review." : adminNote,
      href: "/dashboard",
    });
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: `seller_verification_${decision}`,
      resource_type: "seller_verification",
      resource_id: verification.id,
      details: { seller_id: verification.seller_id, store_id: verification.store_id, legal_name: verification.legal_name },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  if (store?.slug) revalidatePath(`/stores/${store.slug}`);
  redirect("/admin");
}

export async function reviewListingReport(formData: FormData) {
  const reportId = field(formData, "reportId");
  const decision = field(formData, "decision");
  if (!isUuid(reportId) || !["resolved", "dismissed"].includes(decision)) redirect("/admin");

  const { supabase, user } = await requireAdmin();
  const { data: report } = await supabase
    .from("listing_reports")
    .select("id,product_id,reason")
    .eq("id", reportId)
    .eq("status", "open")
    .maybeSingle();
  if (report) {
    const { error } = await supabase.from("listing_reports").update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", report.id).eq("status", "open");
    if (!error) await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: `listing_report_${decision}`,
      resource_type: "listing_report",
      resource_id: report.id,
      details: { product_id: report.product_id, reason: report.reason },
    });
  }
  revalidatePath("/admin");
  redirect("/admin");
}

export async function reviewServiceDispute(formData: FormData) {
  const disputeId = field(formData, "disputeId");
  const decision = field(formData, "decision");
  if (!isUuid(disputeId) || !["under_review", "resolved", "dismissed"].includes(decision)) redirect("/admin");

  const { supabase, user } = await requireAdmin();
  const { data: dispute } = await supabase
    .from("service_disputes")
    .select("id,project_id,reason,service_projects(customer_id,seller_id)")
    .eq("id", disputeId)
    .in("status", ["open", "under_review"])
    .maybeSingle();
  if (dispute) {
    const closed = decision === "resolved" || decision === "dismissed";
    const { error } = await supabase.from("service_disputes").update({
      status: decision,
      resolved_at: closed ? new Date().toISOString() : null,
      resolved_by: closed ? user.id : null,
    }).eq("id", dispute.id);
    if (!error) {
      const project = Array.isArray(dispute.service_projects) ? dispute.service_projects[0] : dispute.service_projects;
      if (project) await supabase.from("notifications").insert([project.customer_id, project.seller_id].map((userId) => ({
        user_id: userId,
        kind: "account",
        title: "Service dispute updated",
        body: decision === "under_review" ? "Coursely AI has started reviewing this service dispute." : `The service dispute has been ${decision}.`,
        href: "/inbox",
      })));
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: `service_dispute_${decision}`,
        resource_type: "service_dispute",
        resource_id: dispute.id,
        details: { project_id: dispute.project_id, reason: dispute.reason },
      });
    }
  }
  revalidatePath("/admin");
  revalidatePath("/inbox");
  redirect("/admin");
}

export async function reviewSupportTicket(formData: FormData) {
  const ticketId = field(formData, "ticketId");
  const decision = field(formData, "decision");
  const adminNote = field(formData, "adminNote");
  if (!isUuid(ticketId) || !["in_progress", "resolved"].includes(decision) || adminNote.length > 4000) redirect("/admin");

  const { supabase, user } = await requireAdmin();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id,user_id,subject,status")
    .eq("id", ticketId)
    .in("status", ["open", "in_progress"])
    .maybeSingle();
  if (ticket) {
    const resolved = decision === "resolved";
    const { error } = await supabase.from("support_tickets").update({
      status: decision,
      admin_note: adminNote || null,
      assigned_to: user.id,
      resolved_at: resolved ? new Date().toISOString() : null,
    }).eq("id", ticket.id);
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        kind: "account",
        title: "Support ticket updated",
        body: resolved ? `Your support ticket "${ticket.subject}" has been resolved.` : `Coursely AI is reviewing your support ticket "${ticket.subject}".`,
        href: "/support",
      });
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: `support_ticket_${decision}`,
        resource_type: "support_ticket",
        resource_id: ticket.id,
        details: { subject: ticket.subject },
      });
    }
  }
  revalidatePath("/admin");
  revalidatePath("/support");
  redirect("/admin");
}

export async function createCoupon(formData: FormData) {
  const code = field(formData, "code").toUpperCase();
  const discountType = field(formData, "discountType");
  const value = Number(field(formData, "value"));
  const minimumOrder = Number(field(formData, "minimumOrder") || "0");
  const maximumUsesRaw = field(formData, "maximumUses");
  const maximumUses = maximumUsesRaw ? Number(maximumUsesRaw) : null;
  const expiresAt = field(formData, "expiresAt");
  if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !["percent", "fixed"].includes(discountType) || !Number.isFinite(value) || value <= 0 || (discountType === "percent" && value > 100) || !Number.isFinite(minimumOrder) || minimumOrder < 0 || (maximumUses !== null && (!Number.isInteger(maximumUses) || maximumUses < 1))) redirect("/admin");

  const { supabase, user } = await requireAdmin();
  await supabase.from("coupons").insert({
    code,
    discount_type: discountType,
    discount_value: discountType === "percent" ? Math.round(value * 100) : Math.round(value * 100),
    minimum_order_paise: Math.round(minimumOrder * 100),
    maximum_uses: maximumUses,
    expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59+05:30`).toISOString() : null,
    created_by: user.id,
  });
  revalidatePath("/admin");
  redirect("/admin");
}

export async function toggleCoupon(formData: FormData) {
  const couponId = field(formData, "couponId");
  const enabled = field(formData, "enabled") === "true";
  if (!isUuid(couponId)) redirect("/admin");
  const { supabase } = await requireAdmin();
  await supabase.from("coupons").update({ is_active: enabled }).eq("id", couponId);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function createPromotionalBanner(formData: FormData) {
  const title = field(formData, "title");
  const subtitle = field(formData, "subtitle");
  const href = field(formData, "href");
  const placement = field(formData, "placement");
  const endsAt = field(formData, "endsAt");
  if (title.length < 3 || title.length > 100 || subtitle.length > 240 || (href && !href.startsWith("/")) || !["home", "marketplace"].includes(placement)) redirect("/admin");
  const { supabase, user } = await requireAdmin();
  await supabase.from("promotional_banners").insert({
    title,
    subtitle: subtitle || null,
    href: href || null,
    placement,
    ends_at: endsAt ? new Date(`${endsAt}T23:59:59+05:30`).toISOString() : null,
    created_by: user.id,
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/marketplace");
  redirect("/admin");
}

export async function togglePromotionalBanner(formData: FormData) {
  const bannerId = field(formData, "bannerId");
  const enabled = field(formData, "enabled") === "true";
  if (!isUuid(bannerId)) redirect("/admin");
  const { supabase } = await requireAdmin();
  await supabase.from("promotional_banners").update({ is_active: enabled }).eq("id", bannerId);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/marketplace");
  redirect("/admin");
}

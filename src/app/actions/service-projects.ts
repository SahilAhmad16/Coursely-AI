"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ServiceActionResult = { error?: string; success?: string };

type Project = { id: string; conversation_id: string; customer_id: string; seller_id: string; status: string; revision_limit: number; revisions_used: number };

const uuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getProject(projectId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!uuid(projectId)) return null;
  const { data } = await supabase.from("service_projects").select("id,conversation_id,customer_id,seller_id,status,revision_limit,revisions_used").eq("id", projectId).maybeSingle();
  const project = data as Project | null;
  if (!project || (project.customer_id !== userId && project.seller_id !== userId)) return null;
  return project;
}

async function recordAudit(supabase: Awaited<ReturnType<typeof createClient>>, actorId: string, action: string, projectId: string, conversationId: string) {
  await supabase.from("audit_logs").insert({ actor_id: actorId, action, resource_type: "service_project", resource_id: projectId, details: { conversation_id: conversationId } });
}

function refreshConversation(conversationId: string) {
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/inbox");
}

export async function createServiceProject(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const conversationId = value(formData, "conversationId");
  const brief = value(formData, "customerBrief");
  if (!uuid(conversationId) || brief.length < 20 || brief.length > 3000) return { error: "Describe the work you need in 20 to 3,000 characters." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const { data: conversation } = await supabase.from("conversations").select("id,product_id,customer_id,seller_id,products(listing_type,listing_details)").eq("id", conversationId).maybeSingle();
  const row = conversation as { id: string; product_id: string; customer_id: string; seller_id: string; products: { listing_type: string; listing_details: Record<string, unknown> | null } | { listing_type: string; listing_details: Record<string, unknown> | null }[] | null } | null;
  const product = Array.isArray(row?.products) ? row?.products[0] : row?.products;
  if (!row || row.customer_id !== user.id || product?.listing_type !== "service") return { error: "Only the customer can create a work request for this service." };
  const configuredRevisions = Number(product.listing_details?.serviceRevisions ?? 0);
  const revisionLimit = Number.isInteger(configuredRevisions) && configuredRevisions >= 0 && configuredRevisions <= 20 ? configuredRevisions : 0;
  const { data: created, error } = await supabase.from("service_projects").insert({ conversation_id: row.id, product_id: row.product_id, customer_id: row.customer_id, seller_id: row.seller_id, customer_brief: brief, revision_limit: revisionLimit }).select("id").single();
  if (error || !created) return { error: error?.code === "23505" ? "A work request already exists for this conversation." : "Work request could not be created." };
  await recordAudit(supabase, user.id, "service_project_requested", created.id, row.id);
  refreshConversation(row.id);
  return { success: "Work request sent to the service provider." };
}

export async function acceptServiceProject(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const projectId = value(formData, "projectId");
  const deadline = value(formData, "deadline");
  if (!uuid(projectId) || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { error: "Choose a valid delivery deadline." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const project = await getProject(projectId, user.id, supabase);
  if (!project || project.seller_id !== user.id || project.status !== "requested") return { error: "This request is no longer available to accept." };
  const { error } = await supabase.from("service_projects").update({ status: "active", agreed_deadline: deadline }).eq("id", project.id).eq("status", "requested");
  if (error) return { error: "The work request could not be accepted. Choose today or a future deadline." };
  await recordAudit(supabase, user.id, "service_project_accepted", project.id, project.conversation_id);
  refreshConversation(project.conversation_id);
  return { success: "Service work is now active." };
}

export async function addServiceMilestone(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const projectId = value(formData, "projectId");
  const title = value(formData, "title");
  const details = value(formData, "details");
  const dueDate = value(formData, "dueDate");
  if (!uuid(projectId) || title.length < 3 || title.length > 160 || details.length > 1500 || (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) return { error: "Check the milestone title, details, and due date." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const project = await getProject(projectId, user.id, supabase);
  if (!project || project.seller_id !== user.id || !["active", "revision_requested"].includes(project.status)) return { error: "Only the active service provider can add milestones." };
  const { data: last } = await supabase.from("service_milestones").select("position").eq("project_id", project.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = Math.min(100, Number(last?.position ?? -1) + 1);
  const { error } = await supabase.from("service_milestones").insert({ project_id: project.id, title, details: details || null, due_date: dueDate || null, position });
  if (error) return { error: "Milestone could not be saved." };
  await recordAudit(supabase, user.id, "service_milestone_added", project.id, project.conversation_id);
  refreshConversation(project.conversation_id);
  return { success: "Milestone added." };
}

export async function submitServiceDelivery(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const projectId = value(formData, "projectId");
  const milestoneId = value(formData, "milestoneId");
  const note = value(formData, "deliveryNote");
  if (!uuid(projectId) || note.length < 10 || note.length > 3000 || (milestoneId && !uuid(milestoneId))) return { error: "Add a clear delivery note before submitting." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const project = await getProject(projectId, user.id, supabase);
  if (!project || project.seller_id !== user.id || !["active", "revision_requested"].includes(project.status)) return { error: "This project is not ready for a delivery." };
  if (milestoneId) {
    const { data: milestone } = await supabase.from("service_milestones").select("id").eq("id", milestoneId).eq("project_id", project.id).maybeSingle();
    if (!milestone) return { error: "Choose a milestone from this project." };
  }
  if (project.status === "revision_requested") await supabase.from("service_revision_requests").update({ status: "addressed", addressed_at: new Date().toISOString() }).eq("project_id", project.id).eq("status", "open");
  const { error: deliveryError } = await supabase.from("service_deliveries").insert({ project_id: project.id, milestone_id: milestoneId || null, submitted_by: user.id, note });
  if (deliveryError) return { error: "Delivery could not be submitted." };
  const { error: projectError } = await supabase.from("service_projects").update({ status: "delivery_submitted", last_delivery_at: new Date().toISOString() }).eq("id", project.id).in("status", ["active", "revision_requested"]);
  if (projectError) return { error: "Delivery note was saved, but project status could not be updated." };
  await recordAudit(supabase, user.id, "service_delivery_submitted", project.id, project.conversation_id);
  refreshConversation(project.conversation_id);
  return { success: "Delivery submitted for customer review." };
}

export async function requestServiceRevision(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const projectId = value(formData, "projectId");
  const note = value(formData, "revisionNote");
  if (!uuid(projectId) || note.length < 10 || note.length > 3000) return { error: "Explain the requested revision in 10 to 3,000 characters." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const project = await getProject(projectId, user.id, supabase);
  if (!project || project.customer_id !== user.id || project.status !== "delivery_submitted") return { error: "A revision can be requested only after a delivery is submitted." };
  if (project.revisions_used >= project.revision_limit) return { error: "All included revisions have already been used." };
  const { error: revisionError } = await supabase.from("service_revision_requests").insert({ project_id: project.id, requested_by: user.id, note });
  if (revisionError) return { error: "Revision request could not be saved." };
  const { error: projectError } = await supabase.from("service_projects").update({ status: "revision_requested", revisions_used: project.revisions_used + 1 }).eq("id", project.id).eq("status", "delivery_submitted");
  if (projectError) return { error: "Revision request was saved, but project status could not be updated." };
  await recordAudit(supabase, user.id, "service_revision_requested", project.id, project.conversation_id);
  refreshConversation(project.conversation_id);
  return { success: "Revision request sent to the service provider." };
}

export async function completeServiceProject(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const projectId = value(formData, "projectId");
  if (!uuid(projectId)) return { error: "Invalid project." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const project = await getProject(projectId, user.id, supabase);
  if (!project || project.customer_id !== user.id || project.status !== "delivery_submitted") return { error: "Only the customer can complete a submitted delivery." };
  const { error } = await supabase.from("service_projects").update({ status: "completed" }).eq("id", project.id).eq("status", "delivery_submitted");
  if (error) return { error: "Project could not be completed." };
  await recordAudit(supabase, user.id, "service_project_completed", project.id, project.conversation_id);
  refreshConversation(project.conversation_id);
  return { success: "Project marked complete." };
}

export async function openServiceDispute(_: ServiceActionResult, formData: FormData): Promise<ServiceActionResult> {
  const projectId = value(formData, "projectId");
  const reason = value(formData, "reason");
  const details = value(formData, "details");
  if (!uuid(projectId) || !["scope", "delay", "quality", "communication", "other"].includes(reason) || details.length < 10 || details.length > 3000) return { error: "Choose a reason and describe the issue in 10 to 3,000 characters." };
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please log in again." };
  const project = await getProject(projectId, user.id, supabase);
  if (!project || !["requested", "active", "revision_requested", "delivery_submitted"].includes(project.status)) return { error: "A dispute cannot be opened for this project state." };
  const { error: disputeError } = await supabase.from("service_disputes").insert({ project_id: project.id, opened_by: user.id, reason, details });
  if (disputeError) return { error: disputeError.code === "23505" ? "There is already an open dispute for this project." : "Dispute could not be opened." };
  const { error: projectError } = await supabase.from("service_projects").update({ status: "disputed" }).eq("id", project.id);
  if (projectError) return { error: "Dispute was opened, but project status could not be updated." };
  await recordAudit(supabase, user.id, "service_dispute_opened", project.id, project.conversation_id);
  refreshConversation(project.conversation_id);
  return { success: "Dispute opened. It will be visible to Coursely AI administration." };
}

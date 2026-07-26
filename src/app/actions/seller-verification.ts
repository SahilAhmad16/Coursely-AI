"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SellerVerificationResult = {
  error?: string;
  success?: string;
  replacedPath?: string | null;
};

const businessTypes = new Set(["individual", "sole_proprietor", "partnership", "company"]);
const documentKinds = new Set(["pan", "gst", "business_registration", "government_id", "other"]);

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function submitSellerVerification(formData: FormData): Promise<SellerVerificationResult> {
  const storeId = value(formData, "storeId");
  const legalName = value(formData, "legalName");
  const businessType = value(formData, "businessType");
  const documentKind = value(formData, "documentKind");
  const documentLast4 = value(formData, "documentLast4").toUpperCase();
  const addressLine = value(formData, "addressLine");
  const documentPath = value(formData, "documentPath");

  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return { error: "Create your seller store first, then submit verification." };
  if (legalName.length < 2 || legalName.length > 120) return { error: "Enter the legal name as shown on your document." };
  if (!businessTypes.has(businessType)) return { error: "Choose a valid business type." };
  if (!documentKinds.has(documentKind)) return { error: "Choose a valid document type." };
  if (!/^[A-Z0-9]{4}$/.test(documentLast4)) return { error: "Enter only the last four letters or numbers of the document ID." };
  if (addressLine.length < 10 || addressLine.length > 500) return { error: "Enter a complete business or operating address." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (!documentPath.startsWith(`${user.id}/${storeId}/`) || documentPath.includes("..")) return { error: "Upload a valid verification document before submitting." };

  const { data: store } = await supabase
    .from("stores")
    .select("id,name")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { error: "Seller store not found." };

  const { data: existing } = await supabase
    .from("seller_verifications")
    .select("id,status,document_path")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (existing?.status === "submitted") return { error: "Your verification is already under review." };
  if (existing?.status === "approved") return { error: "Your seller verification has already been approved." };

  const payload = {
    seller_id: user.id,
    store_id: store.id,
    legal_name: legalName,
    business_type: businessType,
    document_kind: documentKind,
    document_last4: documentLast4,
    address_line: addressLine,
    document_path: documentPath,
    status: "submitted" as const,
    review_note: null,
    reviewed_at: null,
    reviewed_by: null,
  };

  const { error } = existing
    ? await supabase.from("seller_verifications").update(payload).eq("id", existing.id)
    : await supabase.from("seller_verifications").insert(payload);
  if (error) return { error: "Verification could not be submitted. Please check the details and try again." };

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: existing ? "seller_verification_resubmitted" : "seller_verification_submitted",
    resource_type: "seller_verification",
    resource_id: existing?.id ?? null,
    details: { store_id: store.id, document_kind: documentKind },
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return {
    success: "Verification submitted. Coursely AI will review it before listings can go live.",
    replacedPath: existing?.document_path ?? null,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ConversationResult = { error?: string; conversationId?: string };
type MessageResult = { error?: string; success?: string };
type FileMessageResult = { error?: string; success?: string };

export async function startConversation(productId: string): Promise<ConversationResult> {
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "Invalid service listing." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to contact the seller." };
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id,listing_type,status,stores!inner(owner_id)")
    .eq("id", productId)
    .eq("status", "published")
    .maybeSingle();
  const store = product?.stores as { owner_id: string } | { owner_id: string }[] | null;
  const sellerId = Array.isArray(store) ? store[0]?.owner_id : store?.owner_id;
  if (productError || !product || product.listing_type !== "service" || !sellerId) return { error: "This service is not available for messages." };
  if (sellerId === user.id) return { error: "You cannot start a customer conversation with your own service." };

  const { data: existing } = await supabase.from("conversations").select("id").eq("product_id", productId).eq("customer_id", user.id).maybeSingle();
  if (existing) return { conversationId: existing.id };
  const { data: conversation, error } = await supabase.from("conversations").insert({ product_id: productId, customer_id: user.id, seller_id: sellerId }).select("id").single();
  if (error || !conversation) return { error: "We could not open this conversation. Please try again." };
  return { conversationId: conversation.id };
}

export async function sendMessage(_: MessageResult, formData: FormData): Promise<MessageResult> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(conversationId) || !body || body.length > 2000) return { error: "Write a message between 1 and 2,000 characters." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again before sending a message." };
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
  if (error) return { error: "Message could not be sent. Please try again." };
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/inbox");
  return { success: "Message sent." };
}

export async function sendFileMessage(conversationId: string, path: string, fileName: string, mimeType: string, byteSize: number): Promise<FileMessageResult> {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId) || !fileName || fileName.length > 160 || !mimeType || !Number.isInteger(byteSize) || byteSize < 1 || byteSize > 25 * 1024 * 1024) return { error: "Invalid file details." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again before sharing a file." };
  if (!path.startsWith(`${conversationId}/${user.id}/`) || path.includes("..")) return { error: "Invalid upload path." };
  const { data: conversation } = await supabase.from("conversations").select("id,customer_id,seller_id").eq("id", conversationId).maybeSingle();
  if (!conversation || (conversation.customer_id !== user.id && conversation.seller_id !== user.id)) return { error: "This conversation is not available." };
  const { data: message, error: messageError } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body: `Shared a file: ${fileName}` }).select("id").single();
  if (messageError || !message) return { error: "Message could not be created. Please try again." };
  const { error: attachmentError } = await supabase.from("message_attachments").insert({ message_id: message.id, sender_id: user.id, path, file_name: fileName, mime_type: mimeType, byte_size: byteSize });
  if (attachmentError) return { error: "File uploaded, but it could not be attached to this message." };
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/inbox");
  return { success: "File shared." };
}

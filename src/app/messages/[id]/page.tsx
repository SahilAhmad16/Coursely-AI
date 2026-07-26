import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageThread } from "@/components/message-thread";
import {
  ServiceProjectPanel,
  type ServiceDelivery,
  type ServiceDispute,
  type ServiceMilestone,
  type ServiceProject,
  type ServiceRevision,
} from "@/components/service-project-panel";
import { ServiceSellerLocked } from "@/components/service-seller-locked";
import { getCurrentUserSellerAccess } from "@/lib/service-seller-plan";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Conversation = {
  id: string;
  product_id: string;
  customer_id: string;
  seller_id: string;
  products: { title: string; listing_type: string } | { title: string; listing_type: string }[] | null;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  message_attachments: { id: string; file_name: string; path: string }[] | null;
};

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const sellerAccess = await getCurrentUserSellerAccess(supabase, user.id);
  if (sellerAccess.isLocked) return <ServiceSellerLocked subscriptions={sellerAccess.lockedPlans} />;

  const [{ data: conversation, error }, { data: rows }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id,product_id,customer_id,seller_id,products(title,listing_type)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id,sender_id,body,created_at,message_attachments(id,file_name,path)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (error || !conversation) notFound();

  const item = conversation as Conversation;
  const product = Array.isArray(item.products) ? item.products[0] : item.products;
  const messages = await Promise.all(
    ((rows ?? []) as Message[]).map(async (row) => ({
      id: row.id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
      attachments: await Promise.all(
        (row.message_attachments ?? []).map(async (attachment) => {
          const { data } = await supabase.storage
            .from("message-files")
            .createSignedUrl(attachment.path, 60 * 20);
          return { id: attachment.id, fileName: attachment.file_name, url: data?.signedUrl ?? null };
        }),
      ),
    })),
  );

  let project: ServiceProject | null = null;
  let milestones: ServiceMilestone[] = [];
  let deliveries: ServiceDelivery[] = [];
  let revisions: ServiceRevision[] = [];
  let disputes: ServiceDispute[] = [];

  if (product?.listing_type === "service") {
    const { data: projectRow } = await supabase
      .from("service_projects")
      .select("id,customer_id,seller_id,customer_brief,agreed_deadline,revision_limit,revisions_used,status,created_at")
      .eq("conversation_id", item.id)
      .maybeSingle();

    project = projectRow as ServiceProject | null;

    if (project) {
      const [milestoneResult, deliveryResult, revisionResult, disputeResult] = await Promise.all([
        supabase
          .from("service_milestones")
          .select("id,title,details,due_date,position,status")
          .eq("project_id", project.id)
          .order("position", { ascending: true }),
        supabase
          .from("service_deliveries")
          .select("id,note,created_at,milestone_id")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("service_revision_requests")
          .select("id,note,status,created_at")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("service_disputes")
          .select("id,reason,details,status,created_at")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
      ]);

      milestones = (milestoneResult.data ?? []) as ServiceMilestone[];
      deliveries = (deliveryResult.data ?? []) as ServiceDelivery[];
      revisions = (revisionResult.data ?? []) as ServiceRevision[];
      disputes = (disputeResult.data ?? []) as ServiceDispute[];
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-black">Coursely AI</Link>
          <Link href="/inbox" className="text-sm font-semibold">All messages</Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">{product?.listing_type === "service" ? "Service chat" : "Conversation"}</p>
        <h1 className="mt-2 text-3xl font-black">{product?.title ?? "Conversation"}</h1>
        <p className="mt-2 text-sm text-slate-600">Keep payments and work scope on Coursely AI. Do not share passwords, OTPs, or payment details in messages.</p>
        {product?.listing_type === "service" && (
          <div className="mt-7">
            <ServiceProjectPanel
              currentUserId={user.id}
              conversationId={item.id}
              project={project}
              milestones={milestones}
              deliveries={deliveries}
              revisions={revisions}
              disputes={disputes}
            />
          </div>
        )}
        <div className="mt-7 rounded-2xl bg-white p-5 shadow-sm">
          <MessageThread conversationId={item.id} currentUserId={user.id} messages={messages} />
        </div>
      </section>
    </main>
  );
}

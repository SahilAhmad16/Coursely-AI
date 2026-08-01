import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ orderId: string; productId: string }> }) {
  const { orderId, productId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: item } = await supabase
    .from("order_items")
    .select("product_id,listing_type_snapshot,orders!inner(buyer_id,status)")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .eq("orders.buyer_id", user.id)
    .in("orders.status", ["paid", "fulfilled"])
    .maybeSingle();

  if (!item || item.listing_type_snapshot !== "digital") {
    return NextResponse.json({ error: "A paid digital purchase is required." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: product } = await admin.from("products").select("digital_file_path").eq("id", productId).maybeSingle();
  if (!product?.digital_file_path) return NextResponse.json({ error: "This file is temporarily unavailable." }, { status: 404 });

  const { data, error } = await admin.storage.from("digital-assets").createSignedUrl(product.digital_file_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "The private download link could not be created." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, 302);
}

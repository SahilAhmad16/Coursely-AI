import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function PromotionalBanner({ placement, dark = false }: { placement: "home" | "marketplace"; dark?: boolean }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("promotional_banners")
    .select("id,title,subtitle,href")
    .eq("placement", placement)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const content = <div className={`mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${dark ? "border-emerald-300/30 bg-emerald-300/10 text-white" : "border-emerald-200 bg-emerald-50 text-slate-950"}`}><div><p className="font-black">{data.title}</p>{data.subtitle && <p className={`mt-1 text-sm ${dark ? "text-slate-300" : "text-slate-600"}`}>{data.subtitle}</p>}</div>{data.href && <span className="text-sm font-bold text-emerald-600">Explore →</span>}</div>;
  return <aside aria-label="Announcement" className="relative z-10 px-5 pt-4 md:px-8">{data.href ? <Link href={data.href}>{content}</Link> : content}</aside>;
}

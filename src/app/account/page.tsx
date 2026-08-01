import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteAddress, markNotificationRead, saveAddress, setDefaultAddress, updateProfile } from "@/app/actions/account";
import { formatPrice } from "@/lib/data/marketplace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Address = { id: string; label: string; recipient_name: string; phone: string; line1: string; line2: string | null; city: string; state: string; postal_code: string; is_default: boolean };
type WishlistRow = { product_id: string; products: { title: string; slug: string; price_paise: number; listing_type: string } | { title: string; slug: string; price_paise: number; listing_type: string }[] | null };
type OrderItem = { product_id: string; title_snapshot: string; listing_type_snapshot: string; quantity: number };
type OrderRow = { id: string; order_number: number; status: string; total_paise: number; currency: string; created_at: string; order_items: OrderItem[] | null };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: addresses }, { data: notifications }, { data: wishlist }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("full_name,username,phone,bio,role").eq("id", user.id).maybeSingle(),
    supabase.from("saved_addresses").select("id,label,recipient_name,phone,line1,line2,city,state,postal_code,is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("notifications").select("id,title,body,href,read_at,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("wishlists").select("product_id,products(title,slug,price_paise,listing_type)").order("created_at", { ascending: false }),
    supabase.from("orders").select("id,order_number,status,total_paise,currency,created_at,order_items(product_id,title_snapshot,listing_type_snapshot,quantity)").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const wishlists = (wishlist ?? []) as WishlistRow[];
  const orderRows = (orders ?? []) as OrderRow[];
  const message = params.updated ? "Saved successfully." : params.error ? "We could not save that information. Please check the fields and try again." : null;

  return <main className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4"><Link href="/" className="font-black">Coursely AI</Link><div className="flex gap-4 text-sm font-semibold"><Link href="/marketplace">Marketplace</Link><Link href="/dashboard">Dashboard</Link></div></div></header>
    <section className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">My account</p>
      <h1 className="mt-2 text-4xl font-black">Account, orders and saved items</h1>
      {message ? <p className={`mt-5 rounded-xl p-4 text-sm font-semibold ${params.error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`}>{message}</p> : null}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_.9fr]">
        <div className="space-y-8">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Profile</h2>
            <form action={updateProfile} className="mt-5 space-y-4">
              <Field label="Full name" name="fullName" defaultValue={profile?.full_name ?? ""} required />
              <Field label="Username (optional)" name="username" defaultValue={profile?.username ?? ""} placeholder="your-store-name" />
              <Field label="Phone (optional)" name="phone" defaultValue={profile?.phone ?? ""} inputMode="tel" />
              <label className="block text-sm font-bold">About you<textarea name="bio" defaultValue={profile?.bio ?? ""} maxLength={500} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal" placeholder="Tell buyers and sellers a little about yourself." /></label>
              <button className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Save profile</button>
            </form>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Saved addresses</h2>
            <p className="mt-2 text-sm text-slate-600">Saved addresses remain available for account and billing details. Affiliate product delivery is handled by the external partner.</p>
            <div className="mt-5 space-y-3">{(addresses ?? []).map((address) => <AddressCard key={address.id} address={address as Address} />)}{!addresses?.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No saved addresses yet.</p> : null}</div>
            <form action={saveAddress} className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
              <h3 className="font-black sm:col-span-2">Add an address</h3>
              <Field label="Label" name="label" placeholder="Home" required /><Field label="Recipient name" name="recipientName" placeholder="Your full name" required />
              <Field label="Phone" name="phone" placeholder="9876543210" inputMode="tel" required /><Field label="Address line 1" name="line1" placeholder="House no., street" required />
              <Field label="Address line 2 (optional)" name="line2" placeholder="Landmark" /><Field label="City" name="city" placeholder="Lucknow" required />
              <Field label="State" name="state" placeholder="Uttar Pradesh" required /><Field label="PIN code" name="postalCode" placeholder="226001" inputMode="numeric" required />
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input name="isDefault" type="checkbox" /> Make this my default address</label>
              <button className="w-fit rounded-xl bg-slate-950 px-5 py-3 font-bold text-white sm:col-span-2">Save address</button>
            </form>
          </section>
        </div>
        <aside className="space-y-8">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Order history</h2>
            {orderRows.length ? <div className="mt-5 space-y-3">{orderRows.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <p className="mt-4 text-sm text-slate-600">Your Coursely AI orders will appear here.</p>}
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Wishlist</h2>
            {wishlists.length ? <div className="mt-5 space-y-3">{wishlists.map((row) => { const product = Array.isArray(row.products) ? row.products[0] : row.products; return product ? <Link key={row.product_id} href={`/products/${product.slug}`} className="block rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300"><p className="font-bold">{product.title}</p><p className="mt-1 text-sm capitalize text-slate-500">{product.listing_type} · {formatPrice(product.price_paise)}</p></Link> : null; })}</div> : <p className="mt-4 text-sm text-slate-600">Save products from their detail page to see them here.</p>}
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Notifications</h2>
            {notifications?.length ? <div className="mt-5 space-y-3">{notifications.map((notification) => <article key={notification.id} className={`rounded-xl p-4 ${notification.read_at ? "bg-slate-50" : "bg-emerald-50"}`}><p className="font-bold">{notification.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p><div className="mt-3 flex gap-4 text-sm font-bold">{notification.href ? <Link href={notification.href} className="text-emerald-700">Open</Link> : null}{!notification.read_at ? <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><button className="text-slate-600">Mark read</button></form> : null}</div></article>)}</div> : <p className="mt-4 text-sm text-slate-600">Listing approvals and important account updates will appear here.</p>}
          </section>
        </aside>
      </div>
    </section>
  </main>;
}

function OrderCard({ order }: { order: OrderRow }) {
  const digitalItems = (order.order_items ?? []).filter((item) => item.listing_type_snapshot === "digital");
  const isPaid = order.status === "paid" || order.status === "fulfilled";
  return <article className="rounded-xl border border-slate-200 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="font-bold">Order #{order.order_number}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString("en-IN")}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize">{order.status.replaceAll("_", " ")}</span></div>
    <p className="mt-3 text-sm text-slate-600">{(order.order_items ?? []).map((item) => `${item.title_snapshot} × ${item.quantity}`).join(", ")}</p>
    <p className="mt-2 font-black">{formatPrice(order.total_paise, order.currency)}</p>
    {isPaid && digitalItems.length ? <div className="mt-3 flex flex-wrap gap-2">{digitalItems.map((item) => <a key={item.product_id} href={`/api/orders/${order.id}/downloads/${item.product_id}`} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Download {item.title_snapshot}</a>)}</div> : null}
  </article>;
}

function AddressCard({ address }: { address: Address }) {
  return <article className="rounded-xl border border-slate-200 p-4"><p className="font-black">{address.label} {address.is_default ? <span className="ml-1 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Default</span> : null}</p><p className="mt-2 text-sm leading-6 text-slate-600">{address.recipient_name} · {address.phone}<br />{address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />{address.city}, {address.state} — {address.postal_code}</p><div className="mt-4 flex gap-4 text-sm font-bold">{!address.is_default ? <form action={setDefaultAddress}><input type="hidden" name="addressId" value={address.id} /><button className="text-emerald-700">Set default</button></form> : null}<form action={deleteAddress}><input type="hidden" name="addressId" value={address.id} /><button className="text-rose-700">Delete</button></form></div></article>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-sm font-bold">{label}<input className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" {...props} /></label>;
}

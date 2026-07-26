"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";

export function AddToCartButton({ product, available = true }: { product: { id: string; slug: string; title: string; pricePaise: number; currency: string; listingType: string }; available?: boolean }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  if (product.listingType === "affiliate") return null;
  return <div className="mt-5">{available ? <button onClick={() => { addItem(product); setAdded(true); }} className="w-full rounded-xl bg-slate-950 py-3 font-bold text-white transition hover:bg-emerald-700">{added ? "Added to cart" : product.listingType === "service" ? "Add service to cart" : "Add to cart"}</button> : <button disabled className="w-full rounded-xl bg-slate-300 py-3 font-bold text-slate-600">Out of stock</button>}{added && <Link href="/cart" className="mt-3 block text-center text-sm font-bold text-emerald-700">View your cart →</Link>}</div>;
}

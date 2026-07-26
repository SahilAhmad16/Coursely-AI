"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = { id: string; slug: string; title: string; pricePaise: number; currency: string; listingType: string; quantity: number };
type CartContextValue = { items: CartItem[]; addItem: (item: Omit<CartItem, "quantity">) => void; updateQuantity: (id: string, quantity: number) => void; removeItem: (id: string) => void; totalPaise: number };
const CartContext = createContext<CartContextValue | null>(null);

function isSinglePurchase(listingType: string) { return listingType === "digital" || listingType === "service"; }

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { try { const value = localStorage.getItem("coursely-ai-cart"); if (value) { const parsed = JSON.parse(value); if (Array.isArray(parsed)) setItems(parsed.filter((item) => item && item.listingType !== "affiliate")); } } finally { setLoaded(true); } }, []);
  useEffect(() => { if (loaded) localStorage.setItem("coursely-ai-cart", JSON.stringify(items)); }, [items, loaded]);
  const value = useMemo<CartContextValue>(() => ({
    items,
    addItem: (item) => setItems((current) => {
      if (item.listingType === "affiliate") return current;
      const match = current.find((entry) => entry.id === item.id);
      if (!match) return [...current, { ...item, quantity: 1 }];
      return isSinglePurchase(item.listingType) ? current : current.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.min(entry.quantity + 1, 99) } : entry);
    }),
    updateQuantity: (id, quantity) => setItems((current) => quantity < 1 ? current.filter((entry) => entry.id !== id) : current.map((entry) => entry.id === id ? { ...entry, quantity: isSinglePurchase(entry.listingType) ? 1 : Math.min(quantity, 99) } : entry)),
    removeItem: (id) => setItems((current) => current.filter((entry) => entry.id !== id)),
    totalPaise: items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() { const context = useContext(CartContext); if (!context) throw new Error("useCart must be used inside CartProvider"); return context; }

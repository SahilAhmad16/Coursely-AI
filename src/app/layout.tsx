import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { AiHelpWidget } from "@/components/ai-help-widget";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"), title: "Coursely AI | Marketplace for products and services", description: "A marketplace for digital products, professional services, and approved affiliate products.", openGraph: { title: "Coursely AI", description: "Discover digital products, professional services, and approved affiliate offers." } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="min-h-screen antialiased"><CartProvider>{children}<SiteFooter /><AiHelpWidget /></CartProvider></body></html>;
}

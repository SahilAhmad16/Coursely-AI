import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const lastModified = new Date();
  return ["", "/marketplace", "/support", "/policies/privacy", "/policies/terms", "/policies/refunds", "/policies/sellers", "/policies/affiliate"].map((path) => ({ url: `${baseUrl}${path}`, lastModified, changeFrequency: path === "/marketplace" ? "daily" : "weekly", priority: path === "" ? 1 : path === "/marketplace" ? 0.9 : 0.6 }));
}

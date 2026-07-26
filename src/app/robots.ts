import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/account", "/inbox", "/messages", "/seller-plan", "/checkout", "/start", "/sell"] }, sitemap: `${baseUrl}/sitemap.xml` };
}

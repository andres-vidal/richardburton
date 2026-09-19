import type { MetadataRoute } from "next";

const BASE = process.env.APP_URL ?? "http://localhost:3000";

/**
 * The database is open access and meant to be found, so everything is
 * crawlable except the pages that need an account and the endpoints that are
 * not pages at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/admin/", "/*/auth/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}

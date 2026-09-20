import { appUrl } from "modules/app-url";
import type { MetadataRoute } from "next";

// The address belongs to the deployment, so this renders at request time rather
// than being baked into the build.
export const dynamic = "force-dynamic";

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
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}

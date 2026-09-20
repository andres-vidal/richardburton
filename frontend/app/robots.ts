import { appUrl } from "modules/app-url";
import type { MetadataRoute } from "next";

// Where the app answers is the deployment's to say, so this is written where
// it runs rather than baked in where it is built.
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

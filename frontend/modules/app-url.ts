import invariant from "tiny-invariant";

/**
 * Where this deployment answers, for the addresses that have to be absolute:
 * robots.txt, the sitemap, and the canonical URL a page names.
 *
 * Read per call, not once at module load: the value belongs to the deployment,
 * and a build has none. Every caller renders on demand, so none needs it at
 * build time.
 */
function appUrl(): string {
  const url = process.env.APP_URL;
  invariant(url, "Must provide APP_URL.");
  return url;
}

export { appUrl };

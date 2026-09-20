import invariant from "tiny-invariant";

/**
 * Where this deployment answers, for the addresses that have to be absolute:
 * robots.txt, the sitemap, and the canonical URL a page names.
 *
 * Asked for per call rather than read once, because it belongs to the
 * deployment and a build has no deployment to read it from. Everything that
 * asks is rendered on demand, so it is asked for where the app is running and
 * a build never needs it.
 */
function appUrl(): string {
  const url = process.env.APP_URL;
  invariant(url, "Must provide APP_URL.");
  return url;
}

export { appUrl };

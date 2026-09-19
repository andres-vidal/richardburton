import { routing } from "i18n/routing";
import createIntlProxy from "next-intl/middleware";

/**
 * Settles the locale for every request.
 *
 * Who may reach a page is decided by the page itself: `admin/layout.tsx` turns
 * away anyone who cannot edit, and the backend answers 401 regardless. A second
 * guard here would only be a second place to keep in step.
 */
export const proxy = createIntlProxy(routing);

export const config = {
  // Everything but the API routes, Next's own assets and files with an
  // extension — none of those carry a locale.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

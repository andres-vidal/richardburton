import { routing } from "i18n/routing";
import createIntlProxy from "next-intl/middleware";

/**
 * Settles the locale for every request.
 *
 * Access is not checked here. `admin/layout.tsx` turns away anyone who cannot
 * edit, and the backend checks every request itself. It answers 401 when
 * nobody is signed in, and 403 when the user lacks the role, the CSRF token
 * does not match or a captcha failed. A check here would be one more copy of
 * those rules to keep in step.
 */
export const proxy = createIntlProxy(routing);

export const config = {
  // Everything but the API routes, Next's own assets and files with an
  // extension, none of which carry a locale.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

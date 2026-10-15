/**
 * The guards of the admin area. Each redirects a signed-in user who lacks a
 * role away from the page that calls it.
 *
 * Call a guard before reading from the backend, in each page that reads, even
 * when the page's layout calls a guard too. Next.js renders a layout and its
 * page at the same time, so the layout's redirect does not stop the page's
 * read.
 */
import { redirect } from "i18n/navigation";
import { User } from "modules/users";
import { getLocale } from "next-intl/server";

import { getSession } from "app/session";

// Redirects to `href` when `admits` returns false for the signed-in user's
// session.
async function admit(
  admits: (session: User | null) => boolean,
  href: string,
): Promise<void> {
  if (!admits(await getSession())) {
    redirect({ href, locale: await getLocale() });
  }
}

/**
 * Redirects to the public index when the signed-in user cannot edit
 * publications.
 */
export function admitEditors(): Promise<void> {
  return admit(User.canEditPublications, "/");
}

/**
 * Redirects to the admin index when the signed-in user cannot decide who has
 * access. The admin area admits every user who can edit publications, so a
 * page that only an admin may use calls this guard instead.
 */
export function admitAdmins(): Promise<void> {
  return admit(User.canManageAccess, "/admin");
}

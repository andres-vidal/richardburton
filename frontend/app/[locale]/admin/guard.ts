import { redirect } from "i18n/navigation";
import { User } from "modules/users";
import { getLocale } from "next-intl/server";

import { getSession } from "app/session";

/**
 * Redirects to the public index when the signed-in user cannot edit
 * publications.
 *
 * The admin layout calls it for every admin page. A page that reads from the
 * backend also calls it before reading, because Next.js renders a layout and
 * its page at the same time, not one after the other. Without its own call,
 * the page's read would still run for a user the layout is redirecting, and
 * would fail.
 */
export async function admitEditors(): Promise<void> {
  if (!User.canEditPublications(await getSession())) {
    redirect({ href: "/", locale: await getLocale() });
  }
}

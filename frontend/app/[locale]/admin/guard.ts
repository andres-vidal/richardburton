import { redirect } from "i18n/navigation";
import { User } from "modules/users";
import { getLocale } from "next-intl/server";

import { getSession } from "app/session";

/**
 * Redirects to the public index when the signed-in user cannot edit
 * publications.
 *
 * Call it before reading from the backend, in each page that reads, even when
 * the page's layout calls it too. Next.js renders a layout and its page at the
 * same time, so the layout's redirect does not stop the page's read.
 */
export async function admitEditors(): Promise<void> {
  if (!User.canEditPublications(await getSession())) {
    redirect({ href: "/", locale: await getLocale() });
  }
}

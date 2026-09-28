import { redirect } from "i18n/navigation";
import { User } from "modules/users";
import { getLocale } from "next-intl/server";

import { getSession } from "app/session";

/**
 * Send whoever cannot edit publications back to the public index.
 *
 * The admin layout calls it for every admin page. A page that reads from the
 * backend calls it as well, before reading, because the layout renders
 * alongside the page rather than before it. Without the page's own call, its
 * read would still run for a visitor the layout is turning away, and fail.
 */
export async function admitEditors(): Promise<void> {
  if (!User.canEditPublications(await getSession())) {
    redirect({ href: "/", locale: await getLocale() });
  }
}

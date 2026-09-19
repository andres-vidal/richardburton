import { User } from "modules/users";
import { redirect } from "i18n/navigation";
import { getLocale } from "next-intl/server";
import { ReactNode } from "react";
import { getSession } from "app/session";

// Server-side guard for every /admin route: whoever cannot edit publications
// is bounced back to the public index before any admin UI renders. Deciding who
// has access is narrower still, and gated again under /admin/users. The backend
// independently rejects unauthorized mutations — this keeps the pages
// themselves gated.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!User.canEditPublications(session)) {
    redirect({ href: "/", locale: await getLocale() });
  }

  return children;
}

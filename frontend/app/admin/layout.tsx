import { User } from "modules/users";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { getSession } from "../session";

// Server-side guard for every /admin route: non-admin visitors are bounced back
// to the public index before any admin UI renders. The backend independently
// rejects unauthorized mutations — this keeps the pages themselves gated.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session || !User.isAdmin(session.role)) redirect("/");

  return children;
}

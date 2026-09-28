import { ReactNode } from "react";

import { admitEditors } from "./guard";

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
  await admitEditors();

  return children;
}

import { ReactNode } from "react";

import { admitEditors } from "./guard";

// The layout for every /admin route. It redirects a user who cannot edit
// publications to the public index, with `admitEditors`. Next.js renders this
// layout at the same time as the page, so a page that reads from the backend
// calls `admitEditors` itself as well. /admin/users checks a narrower
// permission of its own, and the backend rejects unauthorized requests
// whatever the pages do.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await admitEditors();

  return children;
}

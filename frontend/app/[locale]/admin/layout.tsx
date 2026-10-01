import { ReactNode } from "react";

import { admitEditors } from "./guard";

// The layout for every /admin route. It redirects a user who cannot edit
// publications to the public index, with `admitEditors`. Next.js renders this
// layout at the same time as the page, so the redirect does not stop a page's
// own reads from running.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await admitEditors();

  return children;
}

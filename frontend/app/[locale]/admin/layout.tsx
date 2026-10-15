import { ReactNode } from "react";

import { admitEditors } from "./guard";

/**
 * The layout of every page under `/admin`. It redirects a user who cannot
 * edit publications to the index with `admitEditors`, and otherwise renders
 * the page.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await admitEditors();

  return children;
}

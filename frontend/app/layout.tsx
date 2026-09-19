import { ReactNode } from "react";

/**
 * Next requires a layout at the root of `app`, but the document itself is
 * written one level down, where the locale is known and can be put on `<html>`.
 * This passes straight through.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}

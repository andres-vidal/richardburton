import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * They carry the current locale into every href, so `/publications/1` lands on
 * `/pt/publications/1` for a Portuguese reader. Import these, not the `next`
 * originals, wherever a path is written.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

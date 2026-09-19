import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * They carry the current locale into every href and every push, so a link
 * written as `/publications/1` lands on `/pt/publications/1` for a reader in
 * Portuguese. Import these rather than the `next` originals anywhere a path is
 * written.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

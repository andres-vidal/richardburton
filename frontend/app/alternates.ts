import { routing, type Locale } from "i18n/routing";
import type { Metadata } from "next";

/**
 * Returns the address of the page at `path` in each locale, keyed by locale.
 * `path` is the page's address without the locale, such as `/insights`, or
 * `""` for the index. Each address starts with `base`, which is empty by
 * default and gives relative addresses.
 */
export function localized(path: string, base = ""): Record<Locale, string> {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, `${base}/${locale}${path}`]),
  ) as Record<Locale, string>;
}

/**
 * Returns the `alternates` metadata of the page at `path` read in `locale`:
 * its own address as the canonical one, and its address in every locale.
 *
 * Each locale is its own address. Naming every locale's address marks the
 * pages as translations of one page rather than as duplicates of it.
 */
export function alternates(
  path: string,
  locale: string,
): Metadata["alternates"] {
  return { canonical: `/${locale}${path}`, languages: localized(path) };
}

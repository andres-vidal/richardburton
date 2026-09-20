"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

/** What a country code is called, and the article that name takes. */
type CountryNaming = {
  /** The country's name, or the code itself where the catalogue names none. */
  name(code: string): string;
  /** The article the name takes in a sentence, empty where it takes none. */
  article(code: string): string;
};

/**
 * How to name a country, in the language the page is being read in.
 *
 * Reads the `countryNames` and `countryArticles` catalogues the server fills —
 * see `i18n/request`. Functions rather than one name, so a caller reads the
 * catalogue once and then names a whole list, or hands the naming to
 * `Publication.marking`.
 *
 * A code with no name is shown as itself: the record holds a country the
 * platform no longer knows, and what is stored beats nothing.
 */
function useCountryNaming(): CountryNaming {
  const names = useTranslations("countryNames");
  const articles = useTranslations("countryArticles");

  return useMemo(
    () => ({
      name: (code: string) => (names.has(code) ? names(code) : code),
      article: (code: string) => (articles.has(code) ? articles(code) : ""),
    }),
    [names, articles],
  );
}

export { useCountryNaming };
export type { CountryNaming };

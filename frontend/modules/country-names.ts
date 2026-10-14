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
 * Returns how to name a country in the language of the page.
 *
 * It reads the `countryNames` and `countryArticles` catalogues that
 * `i18n/request` fills from the backend. It returns functions rather than one
 * name, so a caller reads the catalogues once and then names a whole list, or
 * passes the naming to `Publication.marking`.
 *
 * A code with no name is returned as the code. Such a record holds a country
 * the backend no longer lists, and the code is more use than nothing.
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

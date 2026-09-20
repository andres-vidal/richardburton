"use client";

import { useTranslations } from "next-intl";

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
 * A country is stored as its code and read as a name, and the name comes from
 * the `countryNames` catalogue the server fills — see `i18n/request`. This
 * returns functions rather than a single name so that a caller can read the
 * catalogue once and then name a whole list, or hand the naming to
 * `Publication.markedValue`.
 *
 * A code the catalogue has no name for is shown as the code itself. That case
 * is a record holding a country the platform no longer knows about, and showing
 * what is stored is more useful than showing nothing.
 */
function useCountryNaming(): CountryNaming {
  const names = useTranslations("countryNames");
  const articles = useTranslations("countryArticles");

  return {
    name: (code) => (names.has(code) ? names(code) : code),
    article: (code) => (articles.has(code) ? articles(code) : ""),
  };
}

export { useCountryNaming };
export type { CountryNaming };

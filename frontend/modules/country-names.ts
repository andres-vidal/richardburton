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
 * the `countryNames` catalogue the server fills — see `i18n/request`. Asking
 * for it as a function rather than a name at a time is what lets a caller name
 * a whole list, or hand the naming to `Publication.markedValue`, having read
 * the catalogue once.
 *
 * A code the catalogue does not name reads as the code. That is a record
 * holding a country the platform has since stopped knowing, which is worth
 * showing as what is stored rather than as nothing at all.
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

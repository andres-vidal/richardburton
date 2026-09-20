import { get } from "app/api";
import { cache } from "react";

/** A country as the server names it: the code stored, and how it is read. */
type NamedCountry = { id: string; label: string; article?: string | null };

/**
 * Every country named in `locale`, as the two catalogues that name one.
 *
 * `countryNames` answers a code with the country's name, and `countryArticles`
 * with the article that name takes in a sentence. They are catalogues rather
 * than a table this module keeps, so a country is named through the same
 * `useTranslations` every other piece of copy is read through, and the server
 * stays the only place a country is named.
 *
 * A country whose name takes no article is left out of `countryArticles`, which
 * is what `t.has` asks about. A backend that cannot be reached names nothing,
 * and a code is then read as itself.
 */
export const readCountryCatalogues = cache(async (locale: string) => {
  const countries = await get<NamedCountry[]>("/countries", { locale }).catch(
    () => [] as NamedCountry[],
  );

  return {
    countryNames: Object.fromEntries(countries.map((c) => [c.id, c.label])),
    countryArticles: Object.fromEntries(
      countries
        .filter((c) => c.article)
        .map((c) => [c.id, c.article as string]),
    ),
  };
});

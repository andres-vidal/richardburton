import { get } from "app/api";
import { cache } from "react";

/** A country as the server names it: the code stored, and how it is read. */
type NamedCountry = { id: string; label: string; article?: string | null };

/**
 * Every country named in `locale`, as the two catalogues that name one.
 *
 * `countryNames` maps a code to the country's name, `countryArticles` to the
 * article that name takes. Catalogues rather than a table of our own, so a
 * country is read through `useTranslations` like any other copy.
 *
 * A name taking no article is absent from `countryArticles` — the absence
 * `t.has` reports. A backend that cannot be reached leaves both empty, and
 * every code is then shown as itself.
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

import { get } from "app/api";
import { cache } from "react";

/**
 * A country as the server lists it: the code stored, how it is read, and its
 * numeric ISO code, which is null for a country ISO assigns none.
 */
type NamedCountry = {
  id: string;
  label: string;
  article?: string | null;
  numeric?: string | null;
};

/**
 * Every country the server knows, named in `locale`. A backend that cannot be
 * reached answers with none.
 */
const readCountries = cache(async (locale: string) =>
  get<NamedCountry[]>("/countries", { locale }).catch(
    () => [] as NamedCountry[],
  ),
);

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
  const countries = await readCountries(locale);

  return {
    countryNames: Object.fromEntries(countries.map((c) => [c.id, c.label])),
    countryArticles: Object.fromEntries(
      countries
        .filter((c) => c.article)
        .map((c) => [c.id, c.article as string]),
    ),
  };
});

/**
 * Returns a map from each country's numeric ISO code to its alpha-2 code, for
 * the countries that have one. It reads the same list as
 * `readCountryCatalogues`, so a request that needs both fetches it once.
 */
export const readNumericCodes = cache(
  async (locale: string): Promise<Record<string, string>> =>
    Object.fromEntries(
      (await readCountries(locale)).flatMap(({ id, numeric }) =>
        numeric ? [[numeric, id]] : [],
      ),
    ),
);

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
 * The country list read for each locale, kept for the life of the server
 * process because the list does not change while it runs.
 */
const fetched = new Map<string, Promise<NamedCountry[]>>();

/**
 * Returns the country list for `locale`, asking the backend only the first
 * time. A read that fails is removed from `fetched`, so the next call asks
 * again.
 */
function fetchCountries(locale: string): Promise<NamedCountry[]> {
  const known = fetched.get(locale);
  if (known) return known;

  const read = get<NamedCountry[]>("/countries", { locale });
  fetched.set(locale, read);
  read.catch(() => fetched.delete(locale));

  return read;
}

/**
 * Every country the server knows, named in `locale`. A backend that cannot be
 * reached answers with none.
 */
const readCountries = cache((locale: string) =>
  fetchCountries(locale).catch(() => [] as NamedCountry[]),
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

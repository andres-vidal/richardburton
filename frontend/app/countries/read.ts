import { get } from "app/api";
import { cache } from "react";

/**
 * A country as the server lists it: the code stored, how it is read, the
 * article its name takes, and its numeric ISO code, which is null for a country
 * ISO assigns none.
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
 * Returns every country the server knows, named in `locale`, or an empty list
 * when the backend cannot be reached.
 *
 * The backend is asked only the first time for each locale, and the answer is
 * kept in `fetched`. A read that fails is removed from `fetched`, so the next
 * call asks again.
 */
function readCountries(locale: string): Promise<NamedCountry[]> {
  let read = fetched.get(locale);

  if (!read) {
    read = get<NamedCountry[]>("/countries", { locale });
    fetched.set(locale, read);
    read.catch(() => fetched.delete(locale));
  }

  return read.catch(() => []);
}

/**
 * Returns the country names in `locale` as two message catalogues.
 * `countryNames` maps a code to the country's name, and `countryArticles` maps
 * a code to the article its name takes. Countries are read through
 * `useTranslations`, like any other text.
 *
 * A country whose name takes no article has no entry in `countryArticles`,
 * which `t.has` reports. When the backend cannot be reached, both catalogues
 * are empty, and every code is shown as itself.
 */
export const readCountryCatalogues = cache(async (locale: string) => {
  const countries = await readCountries(locale);

  return {
    countryNames: Object.fromEntries(countries.map((c) => [c.id, c.label])),
    countryArticles: Object.fromEntries(
      countries.flatMap((c) => (c.article ? [[c.id, c.article]] : [])),
    ),
  };
});

/**
 * Returns a map from each country's numeric ISO code to its alpha-2 code, for
 * the countries that have one. It reads the same list as
 * `readCountryCatalogues`, which the server asks the backend for once.
 */
export const readNumericCodes = cache(
  async (locale: string): Promise<Record<string, string>> =>
    Object.fromEntries(
      (await readCountries(locale)).flatMap(({ id, numeric }) =>
        numeric ? [[numeric, id]] : [],
      ),
    ),
);

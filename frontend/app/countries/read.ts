import { get } from "app/api";
import type { NamedCountry } from "modules/country";
import { cache } from "react";

/**
 * Every country, named in `locale`.
 *
 * The server is the only place countries are named, and a page shows one the
 * moment it renders, so the whole list is read where the page is assembled
 * rather than fetched once the page is on screen. It is the same list for every
 * reader of a language, which is what `cache` is for.
 */
export const readCountries = cache(
  async (locale: string): Promise<NamedCountry[]> =>
    get<NamedCountry[]>("/countries", { locale }).catch(() => []),
);

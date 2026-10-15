import { LOOKUP, type Country } from "modules/lookup";

/**
 * Replaces every search in `LOOKUP` with a stub that makes no network request.
 *
 * The author, publisher and original-book searches return no results. The
 * country search returns the entries of `countries` whose label contains the
 * term, ignoring case, so it returns no results when `countries` is empty.
 */
function stubLookups(countries: Country[] = []): void {
  LOOKUP.authors = async () => [];
  LOOKUP.publishers = async () => [];
  LOOKUP.originalBooks = async () => [];
  LOOKUP.countries = async (term) =>
    countries.filter((country) =>
      country.label.toLowerCase().includes(term.toLowerCase()),
    );
}

export { stubLookups };

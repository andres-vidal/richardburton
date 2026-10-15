import { readCountryCatalogues } from "app/countries/read";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats } from "./formats";
import { routing } from "./routing";

/**
 * Returns the locale the URL names, falling back to the default, with its
 * messages and formats.
 *
 * The messages are `messages/<locale>.json` plus the `countryNames` and
 * `countryArticles` catalogues read from the backend. Country names come from
 * the backend because a search matches the names the backend holds.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [written, countries] = await Promise.all([
    import(`../messages/${locale}.json`),
    readCountryCatalogues(locale),
  ]);

  return {
    locale,
    messages: { ...written.default, ...countries },
    formats,
  };
});

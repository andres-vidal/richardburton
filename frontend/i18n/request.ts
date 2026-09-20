import { readCountryCatalogues } from "app/countries/read";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats } from "./formats";
import { routing } from "./routing";

/**
 * The messages a server render reads, for whichever locale the URL names.
 *
 * Most of them are written here, in `messages/<locale>.json`. The
 * `countryNames` and `countryArticles` catalogues are not: the server names
 * countries, and it is the names it answers with that a search matches on, so
 * writing them here as well would let the two drift. They are read from the
 * backend and joined to the rest, which is why a reader will not find them in
 * the message files.
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

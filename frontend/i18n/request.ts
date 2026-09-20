import { readCountryCatalogues } from "app/countries/read";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats } from "./formats";
import { routing } from "./routing";

/**
 * The messages a server render reads, for whichever locale the URL names.
 *
 * `messages/<locale>.json`, plus `countryNames` and `countryArticles` fetched
 * from the backend — so they are not in the message files. The server owns
 * country names because a search matches on the very names it answers with.
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

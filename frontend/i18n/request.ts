import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats } from "./formats";
import { routing } from "./routing";

/** The messages a server render reads, for whichever locale the URL names. */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    formats,
  };
});

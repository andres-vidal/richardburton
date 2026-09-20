import { defineRouting } from "next-intl/routing";

/**
 * The locales the interface is written in, and the one a request falls back to.
 *
 * Portuguese is a first-class audience here, not a translation of an English
 * original.
 */
export const routing = defineRouting({
  locales: ["en", "pt"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

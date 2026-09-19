import { defineRouting } from "next-intl/routing";

/**
 * The locales the interface is written in, and the one a request falls back to.
 *
 * The database documents Brazilian literature, so Portuguese is a first-class
 * audience rather than a translation of an English original.
 */
export const routing = defineRouting({
  locales: ["en", "pt"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

import { defineRouting } from "next-intl/routing";

/** The locales the interface is written in, and the one a request falls back to. */
export const routing = defineRouting({
  locales: ["en", "pt"],
  defaultLocale: "en",
});

/** One of the locales in `routing`. */
export type Locale = (typeof routing.locales)[number];

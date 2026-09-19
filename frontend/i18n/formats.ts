import type { Formats } from "next-intl";

/**
 * The shapes the app formats values in, named so a call asks for the shape
 * rather than describing it.
 *
 * Declared once for every language: which parts a date shows, and in which
 * order, is the formatter's to decide from the locale.
 */
export const formats = {
  dateTime: {
    /**
     * How the database dates things — the day, not the hour. History entries,
     * the trash and who joined when all read the same way.
     */
    day: { year: "numeric", month: "short", day: "numeric" },
  },
} satisfies Formats;

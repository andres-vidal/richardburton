import type { Formats } from "next-intl";

/**
 * Named formats, so a call asks for a shape rather than spelling one out.
 *
 * One declaration serves both languages — the formatter reads the order and the
 * wording from the locale.
 */
export const formats = {
  dateTime: {
    /** The day, not the hour. Used everywhere the database shows a date. */
    day: { year: "numeric", month: "short", day: "numeric" },
  },
} satisfies Formats;

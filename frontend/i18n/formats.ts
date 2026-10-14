import type { Formats } from "next-intl";

/**
 * The named formats a call to the formatter can ask for, so a call names a
 * format rather than spelling out its options.
 *
 * Each format serves both languages. The formatter takes the order and the
 * wording from the locale.
 */
export const formats = {
  dateTime: {
    /** The day of a timestamp, without the time. */
    day: { year: "numeric", month: "short", day: "numeric" },
  },
} satisfies Formats;

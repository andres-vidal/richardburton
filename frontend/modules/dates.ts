"use client";

import { useFormatter } from "next-intl";

/**
 * A timestamp as the database shows dates.
 *
 * The shape is the `day` format in `i18n/formats.ts`, declared once for both
 * languages rather than assembled here.
 */
function useFormatDate(): (timestamp: string) => string {
  const format = useFormatter();
  return (timestamp) => format.dateTime(new Date(timestamp), "day");
}

export { useFormatDate };

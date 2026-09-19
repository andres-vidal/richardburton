"use client";

import { useFormatter } from "next-intl";

/**
 * A timestamp as the database shows dates.
 *
 * Which parts a date shows, in which order, is the `day` format declared in
 * `i18n/request.ts` — so the shape is settled once for every language rather
 * than assembled here.
 */
function useFormatDate(): (timestamp: string) => string {
  const format = useFormatter();
  return (timestamp) => format.dateTime(new Date(timestamp), "day");
}

export { useFormatDate };

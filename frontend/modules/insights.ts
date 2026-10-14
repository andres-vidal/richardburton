import type { Matched } from "modules/publication/model";

/**
 * A group's key: a year or a decade, a kind, a country code or a name, a work,
 * or an original author and a translator together. Which one depends on the
 * chart's grouping.
 */
type Key =
  | number
  | string
  | { title: string; authors: string[] }
  | { author: string; translator: string };

/**
 * A year or a decade within a group. `items` holds the names of each item
 * counted in it: a publication's title, a work's original title, a
 * translation's translators, or the one name or country code it is.
 */
type Step = { at: number; total: number; items: string[][] };

/**
 * One group of a chart. `total` is the number of distinct items in it, and
 * `counts` the number in each series. A group's counts can add up to more
 * than its total when an item is in several series. `steps` is present when
 * the chart counts each group in steps of time.
 */
type Group = { key: Key; total: number; counts: number[]; steps?: Step[] };

/**
 * The counts of a chart, as `GET /insights` returns them for its `chart`
 * parameters. `series` names the series: kinds, or country codes followed by
 * null for every other country, or `[null]` for a chart with one series.
 * `hidden` is the number of ranked groups that `top` left out.
 */
type Drawn = { series: (string | null)[]; groups: Group[]; hidden: number };

/**
 * The response of `GET /insights`: counts for every publication in the
 * database, or for the ones a search matches, and a chart of them.
 *
 * A **work** is an original book, and a **translation** is one translated
 * text of a work by its translators. Each publication is of one **kind**. It
 * is a **reissue** when an earlier publication of its translation exists, a
 * **retranslation** when it is the first publication of a translation and the
 * work had an earlier translation, and a **first translation** otherwise.
 * Kinds are judged over the whole database, so a search does not turn a
 * reissue into a first translation.
 */
type Insights = {
  publications: number;
  /** The first and the last year of publication, or null when there are none. */
  years: { first: number; last: number } | null;
  /** The number of distinct works, and of distinct names in each field. */
  totals: {
    works: number;
    originalAuthors: number;
    translators: number;
    publishers: number;
    countries: number;
  };
  /** How many publications cite at least one source. */
  sourced: number;
  chart: Drawn;
  /**
   * The words the search matched with something other than what was typed, or
   * null when there was no search.
   */
  matched: Matched[] | null;
};

/** Returns the sum of `counts`. */
const total = (counts: number[]) =>
  counts.reduce((sum, count) => sum + count, 0);

/**
 * Returns how a year is labelled on a chart's axis: `"major"` for a year
 * divisible by 20, which is always labelled, `"minor"` for another year
 * divisible by 10, which is labelled where there is room, and undefined for
 * any other year.
 */
const tickOf = (year: number) =>
  year % 20 === 0 ? "major" : year % 10 === 0 ? "minor" : undefined;

// Returns the first year of the decade that `year` falls in.
const decadeOf = (year: number) => Math.floor(year / 10) * 10;

/**
 * Returns the first year of every decade from the decade of `first` to the
 * decade of `last`, both included. Returns an empty list when `last` falls in
 * an earlier decade than `first`.
 */
const decadesBetween = (first: number, last: number) => {
  const from = decadeOf(first);

  return Array.from(
    { length: Math.max(0, (decadeOf(last) - from) / 10 + 1) },
    (_, index) => from + index * 10,
  );
};

export { decadesBetween, tickOf, total };
export type { Drawn, Group, Insights, Key, Step };

import type { Matched } from "modules/publication/model";

/** A name and the number of publications it appears in. */
type Counted = { name: string; count: number };

/**
 * The response of `GET /insights`: counts for every publication in the
 * database, or for the ones a search matches.
 *
 * Most counts are numbers of publications, so a book published twice counts
 * twice. `totals` counts distinct works and names instead, `debuts` counts
 * authors, and `retranslated` also counts translations. A **work** is an
 * original book, and a **translation** is one translated text of a work by its
 * translators. A work is **retranslated** when it has more than one
 * translation.
 *
 * Each publication is of one kind. It is a **reissue** when an earlier
 * publication of its translation exists, a **retranslation** when it is the
 * first publication of a translation and the work had an earlier translation,
 * and a **first translation** otherwise. An author's **debut** is the year of
 * their first publication. Kinds and debuts are judged over the whole
 * database, so a search does not turn a reissue into a first translation.
 */
type Insights = {
  publications: number;
  /** The first and the last year of publication, or null when there are none. */
  years: { first: number; last: number } | null;
  /**
   * The number of publications in each year from the first to the last, split
   * by country. `countries` holds the codes of the two countries with the most
   * publications, or fewer. Each year's `counts` holds its publications in
   * each of them, in the same order, and `elsewhere` its publications in any
   * other country.
   */
  annual: {
    countries: string[];
    years: { year: number; counts: number[]; elsewhere: number }[];
  };
  /**
   * The number of publications in each decade, from the first to the last, by
   * kind. A decade is named by its first year. Decades with no publications
   * are included with counts of 0.
   */
  decades: {
    decade: number;
    firstTranslations: number;
    retranslations: number;
    reissues: number;
  }[];
  /**
   * The number of original authors, among those the publications name, whose
   * debut falls in each decade, from the first debut to the last.
   */
  debuts: { decade: number; count: number }[];
  /** The number of distinct works, and of distinct names in each field. */
  totals: {
    works: number;
    originalAuthors: number;
    translators: number;
    publishers: number;
    countries: number;
  };
  /**
   * Up to ten names in each field with the most publications, highest first.
   * Each translator also has the number of publications in each year that has
   * any, earliest first.
   */
  originalAuthors: Counted[];
  translators: (Counted & { years: { year: number; count: number }[] })[];
  publishers: Counted[];
  /**
   * Up to ten pairs of an original author and a translator that appear
   * together in the most publications, highest first.
   */
  pairs: { author: string; translator: string; count: number }[];
  /** Every country of publication by its code, highest count first. */
  countries: { code: string; count: number }[];
  /**
   * Up to ten retranslated works, with the most translations first. `timeline`
   * holds the year each translation was first published, with its
   * translators, earliest first.
   */
  retranslated: {
    title: string;
    authors: string[];
    translations: number;
    timeline: { year: number; translators: string[] }[];
  }[];
  /** How many publications cite at least one source. */
  sourced: number;
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

export { tickOf, total };
export type { Counted, Insights };

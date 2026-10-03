import type { Matched } from "modules/publication/model";

/** A name and the number of publications it appears in. */
type Counted = { name: string; count: number };

/**
 * The response of `GET /insights`: counts for every publication in the
 * database, or for the ones a search matches.
 *
 * Most counts are numbers of publications, so a book published twice counts
 * twice. `totals` counts distinct works and names instead, and `retranslated`
 * also counts translations. A **work** is an original book, and a
 * **translation** is one translated text of a work by its translators. A work
 * is **retranslated** when it has more than one translation.
 */
type Insights = {
  publications: number;
  /** The first and the last year of publication, or null when there are none. */
  years: { first: number; last: number } | null;
  /**
   * The number of publications in each decade, from the first to the last. A
   * decade is named by its first year. Decades with no publications are
   * included with a count of 0.
   */
  decades: { decade: number; count: number }[];
  /** The number of distinct works, and of distinct names in each field. */
  totals: {
    works: number;
    originalAuthors: number;
    translators: number;
    publishers: number;
    countries: number;
  };
  /** Up to ten names in each field with the most publications, highest first. */
  originalAuthors: Counted[];
  translators: Counted[];
  publishers: Counted[];
  /** Every country of publication by its code, highest count first. */
  countries: { code: string; count: number }[];
  /** Up to ten retranslated works, with the most translations first. */
  retranslated: {
    title: string;
    authors: string[];
    translations: number;
    publications: number;
  }[];
  /** How many publications cite at least one source. */
  sourced: number;
  /**
   * The words the search matched with something other than what was typed, or
   * null when there was no search.
   */
  matched: Matched[] | null;
};

export type { Counted, Insights };

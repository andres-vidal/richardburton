import type { Matched } from "modules/publication/model";

/** A name and how many publications name it. */
type Counted = { name: string; count: number };

/**
 * What the database holds, counted: every publication in it, or the ones a
 * search matches.
 *
 * Every count is of publications, so a book published twice counts twice. A
 * **work** is an original book, and a **translation** is one rendering of a
 * work by the people who translated it. A work is **retranslated** when it has
 * more than one translation.
 */
type Insights = {
  publications: number;
  /** The first and the last year of publication, or null when there are none. */
  years: { first: number; last: number } | null;
  /**
   * Publications per decade, from the first decade to the last. A decade is
   * named by its first year, and one with no publications is listed with none.
   */
  decades: { decade: number; count: number }[];
  /** How many distinct works and names the publications hold. */
  totals: {
    works: number;
    originalAuthors: number;
    translators: number;
    publishers: number;
    countries: number;
  };
  /** The ten names in each field that most publications name, most first. */
  originalAuthors: Counted[];
  translators: Counted[];
  publishers: Counted[];
  /** Every country of publication by its code, most first. */
  countries: { code: string; count: number }[];
  /** The ten retranslated works with the most translations. */
  retranslated: {
    title: string;
    authors: string[];
    translations: number;
    publications: number;
  }[];
  /** How many publications cite at least one source. */
  sourced: number;
  /** How the search was read, when there was one. */
  matched: Matched[] | null;
};

export type { Counted, Insights };

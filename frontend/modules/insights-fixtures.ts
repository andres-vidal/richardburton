import type { Insights } from "./insights";

/**
 * Insights into a database of a realistic shape: a long span of years with
 * quiet decades in it, a few names far ahead of the rest, and a work translated
 * three times.
 */
const INSIGHTS: Insights = {
  publications: 428,
  years: { first: 1886, last: 2026 },
  decades: [
    { decade: 1880, count: 3 },
    { decade: 1890, count: 0 },
    { decade: 1900, count: 2 },
    { decade: 1910, count: 0 },
    { decade: 1920, count: 6 },
    { decade: 1930, count: 1 },
    { decade: 1940, count: 8 },
    { decade: 1950, count: 15 },
    { decade: 1960, count: 21 },
    { decade: 1970, count: 27 },
    { decade: 1980, count: 53 },
    { decade: 1990, count: 50 },
    { decade: 2000, count: 61 },
    { decade: 2010, count: 132 },
    { decade: 2020, count: 49 },
  ],
  totals: {
    works: 323,
    originalAuthors: 160,
    translators: 161,
    publishers: 174,
    countries: 4,
  },
  originalAuthors: [
    { name: "Clarice Lispector", count: 35 },
    { name: "Paulo Coelho", count: 35 },
    { name: "Machado de Assis", count: 24 },
    { name: "Jorge Amado", count: 18 },
  ],
  translators: [
    { name: "Alison Entrekin", count: 25 },
    { name: "Clifford E. Landers", count: 25 },
    { name: "Margaret Jull Costa", count: 24 },
    { name: "Benjamin Moser", count: 21 },
  ],
  publishers: [
    { name: "Harper Collins Publishers", count: 30 },
    { name: "New Directions", count: 24 },
    { name: "Bloomsbury", count: 23 },
  ],
  countries: [
    { code: "US", count: 259 },
    { code: "CA", count: 11 },
    { code: "BR", count: 3 },
    { code: "NL", count: 1 },
  ],
  retranslated: [
    {
      title: "Dom Casmurro",
      authors: ["Machado de Assis"],
      translations: 3,
      publications: 4,
    },
    {
      title: "A hora da estrela",
      authors: ["Clarice Lispector"],
      translations: 2,
      publications: 4,
    },
  ],
  sourced: 3,
  matched: null,
};

/** Insights into a search that matched nothing. */
const NOTHING: Insights = {
  publications: 0,
  years: null,
  decades: [],
  totals: {
    works: 0,
    originalAuthors: 0,
    translators: 0,
    publishers: 0,
    countries: 0,
  },
  originalAuthors: [],
  translators: [],
  publishers: [],
  countries: [],
  retranslated: [],
  sourced: 0,
  matched: [],
};

export { INSIGHTS, NOTHING };

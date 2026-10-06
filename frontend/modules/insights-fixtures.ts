import type { Insights } from "./insights";

/**
 * The publications in the United States, in the United Kingdom and elsewhere,
 * in each year from 1886 to 2026 that has any.
 */
const PUBLISHED: Record<number, [number, number, number]> = {
  1886: [0, 2, 0],
  1889: [0, 1, 0],
  1905: [2, 0, 0],
  1920: [1, 0, 0],
  1921: [0, 1, 0],
  1922: [0, 1, 0],
  1925: [1, 0, 0],
  1928: [2, 0, 0],
  1933: [1, 0, 0],
  1943: [1, 0, 0],
  1944: [1, 0, 0],
  1945: [3, 0, 0],
  1946: [1, 0, 0],
  1947: [1, 0, 0],
  1948: [0, 1, 0],
  1951: [1, 0, 0],
  1952: [1, 0, 0],
  1953: [1, 2, 0],
  1954: [1, 2, 0],
  1955: [0, 0, 1],
  1956: [1, 4, 0],
  1959: [0, 1, 0],
  1961: [1, 0, 0],
  1962: [1, 0, 0],
  1963: [4, 1, 0],
  1966: [3, 2, 0],
  1967: [2, 0, 0],
  1968: [2, 0, 0],
  1969: [3, 2, 0],
  1970: [4, 0, 0],
  1971: [1, 0, 0],
  1972: [3, 0, 0],
  1974: [2, 0, 0],
  1975: [1, 1, 0],
  1976: [0, 1, 0],
  1977: [2, 0, 0],
  1978: [1, 4, 0],
  1979: [5, 2, 0],
  1980: [0, 2, 0],
  1981: [2, 1, 0],
  1982: [1, 1, 1],
  1983: [1, 0, 0],
  1984: [5, 2, 0],
  1985: [3, 2, 0],
  1986: [8, 2, 1],
  1987: [1, 1, 0],
  1988: [7, 3, 0],
  1989: [5, 4, 0],
  1990: [6, 3, 1],
  1991: [5, 0, 0],
  1992: [6, 2, 0],
  1993: [2, 0, 0],
  1994: [2, 2, 0],
  1995: [2, 0, 0],
  1996: [1, 0, 0],
  1997: [3, 6, 0],
  1998: [3, 2, 0],
  1999: [2, 2, 0],
  2000: [5, 2, 0],
  2001: [0, 1, 0],
  2002: [2, 3, 0],
  2003: [6, 4, 0],
  2004: [5, 3, 0],
  2005: [3, 2, 0],
  2006: [5, 0, 0],
  2007: [3, 3, 0],
  2008: [6, 2, 0],
  2009: [4, 2, 0],
  2010: [2, 0, 0],
  2011: [4, 1, 0],
  2012: [10, 5, 9],
  2013: [11, 8, 5],
  2014: [10, 9, 1],
  2015: [2, 3, 1],
  2016: [10, 5, 0],
  2017: [6, 3, 1],
  2018: [10, 3, 0],
  2019: [9, 2, 2],
  2020: [3, 2, 1],
  2021: [5, 2, 0],
  2022: [6, 1, 0],
  2023: [8, 7, 1],
  2024: [1, 3, 0],
  2025: [2, 3, 1],
  2026: [3, 0, 0],
};

/** Every year from `first` to `last`, with its counts from `PUBLISHED`. */
function annual(first: number, last: number): Insights["annual"]["years"] {
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const year = first + offset;
    const [us, gb, elsewhere] = PUBLISHED[year] ?? [0, 0, 0];

    return { year, counts: [us, gb], elsewhere };
  });
}

/**
 * Insights for a realistic database: a long span of years that includes
 * decades with few or no publications, a few names with far more publications
 * than the rest, and works with three translations.
 */
const INSIGHTS: Insights = {
  publications: 428,
  years: { first: 1886, last: 2026 },
  annual: { countries: ["US", "GB"], years: annual(1886, 2026) },
  decades: [
    {
      decade: 1880,
      count: 3,
      firstTranslations: 3,
      retranslations: 0,
      reissues: 0,
    },
    {
      decade: 1890,
      count: 0,
      firstTranslations: 0,
      retranslations: 0,
      reissues: 0,
    },
    {
      decade: 1900,
      count: 2,
      firstTranslations: 2,
      retranslations: 0,
      reissues: 0,
    },
    {
      decade: 1910,
      count: 0,
      firstTranslations: 0,
      retranslations: 0,
      reissues: 0,
    },
    {
      decade: 1920,
      count: 6,
      firstTranslations: 4,
      retranslations: 0,
      reissues: 2,
    },
    {
      decade: 1930,
      count: 1,
      firstTranslations: 1,
      retranslations: 0,
      reissues: 0,
    },
    {
      decade: 1940,
      count: 8,
      firstTranslations: 7,
      retranslations: 1,
      reissues: 0,
    },
    {
      decade: 1950,
      count: 15,
      firstTranslations: 6,
      retranslations: 1,
      reissues: 8,
    },
    {
      decade: 1960,
      count: 21,
      firstTranslations: 16,
      retranslations: 2,
      reissues: 3,
    },
    {
      decade: 1970,
      count: 27,
      firstTranslations: 24,
      retranslations: 1,
      reissues: 2,
    },
    {
      decade: 1980,
      count: 53,
      firstTranslations: 42,
      retranslations: 0,
      reissues: 11,
    },
    {
      decade: 1990,
      count: 50,
      firstTranslations: 36,
      retranslations: 4,
      reissues: 10,
    },
    {
      decade: 2000,
      count: 61,
      firstTranslations: 43,
      retranslations: 0,
      reissues: 18,
    },
    {
      decade: 2010,
      count: 132,
      firstTranslations: 99,
      retranslations: 7,
      reissues: 26,
    },
    {
      decade: 2020,
      count: 49,
      firstTranslations: 40,
      retranslations: 2,
      reissues: 7,
    },
  ],
  debuts: [
    {
      count: 3,
      decade: 1880,
    },
    {
      count: 0,
      decade: 1890,
    },
    {
      count: 2,
      decade: 1900,
    },
    {
      count: 0,
      decade: 1910,
    },
    {
      count: 3,
      decade: 1920,
    },
    {
      count: 1,
      decade: 1930,
    },
    {
      count: 5,
      decade: 1940,
    },
    {
      count: 2,
      decade: 1950,
    },
    {
      count: 5,
      decade: 1960,
    },
    {
      count: 10,
      decade: 1970,
    },
    {
      count: 9,
      decade: 1980,
    },
    {
      count: 12,
      decade: 1990,
    },
    {
      count: 19,
      decade: 2000,
    },
    {
      count: 64,
      decade: 2010,
    },
    {
      count: 25,
      decade: 2020,
    },
  ],
  totals: {
    works: 323,
    originalAuthors: 160,
    translators: 161,
    publishers: 174,
    countries: 10,
  },
  originalAuthors: [
    { name: "Clarice Lispector", count: 35 },
    { name: "Paulo Coelho", count: 35 },
    { name: "Machado de Assis", count: 24 },
    { name: "Jorge Amado", count: 18 },
  ],
  translators: [
    {
      name: "Alison Entrekin",
      count: 25,
      years: [
        {
          count: 1,
          year: 2004,
        },
        {
          count: 1,
          year: 2006,
        },
        {
          count: 8,
          year: 2012,
        },
        {
          count: 4,
          year: 2013,
        },
        {
          count: 4,
          year: 2014,
        },
        {
          count: 1,
          year: 2015,
        },
        {
          count: 1,
          year: 2016,
        },
        {
          count: 1,
          year: 2017,
        },
        {
          count: 2,
          year: 2018,
        },
        {
          count: 1,
          year: 2023,
        },
        {
          count: 1,
          year: 2026,
        },
      ],
    },
    {
      name: "Clifford E. Landers",
      count: 25,
      years: [
        {
          count: 2,
          year: 1990,
        },
        {
          count: 1,
          year: 1992,
        },
        {
          count: 1,
          year: 1994,
        },
        {
          count: 3,
          year: 1997,
        },
        {
          count: 3,
          year: 1998,
        },
        {
          count: 2,
          year: 1999,
        },
        {
          count: 2,
          year: 2000,
        },
        {
          count: 2,
          year: 2002,
        },
        {
          count: 2,
          year: 2004,
        },
        {
          count: 2,
          year: 2009,
        },
        {
          count: 1,
          year: 2014,
        },
        {
          count: 1,
          year: 2015,
        },
        {
          count: 1,
          year: 2016,
        },
        {
          count: 1,
          year: 2018,
        },
        {
          count: 1,
          year: 2022,
        },
      ],
    },
    {
      name: "Margaret Jull Costa",
      count: 24,
      years: [
        {
          count: 1,
          year: 1905,
        },
        {
          count: 2,
          year: 1999,
        },
        {
          count: 1,
          year: 2001,
        },
        {
          count: 2,
          year: 2003,
        },
        {
          count: 1,
          year: 2004,
        },
        {
          count: 3,
          year: 2005,
        },
        {
          count: 2,
          year: 2007,
        },
        {
          count: 2,
          year: 2008,
        },
        {
          count: 2,
          year: 2009,
        },
        {
          count: 2,
          year: 2011,
        },
        {
          count: 1,
          year: 2012,
        },
        {
          count: 2,
          year: 2013,
        },
        {
          count: 2,
          year: 2014,
        },
        {
          count: 1,
          year: 2016,
        },
      ],
    },
    {
      name: "Benjamin Moser",
      count: 21,
      years: [
        {
          count: 1,
          year: 2002,
        },
        {
          count: 3,
          year: 2003,
        },
        {
          count: 1,
          year: 2004,
        },
        {
          count: 2,
          year: 2005,
        },
        {
          count: 2,
          year: 2006,
        },
        {
          count: 2,
          year: 2007,
        },
        {
          count: 1,
          year: 2008,
        },
        {
          count: 2,
          year: 2009,
        },
        {
          count: 1,
          year: 2010,
        },
        {
          count: 1,
          year: 2011,
        },
        {
          count: 5,
          year: 2014,
        },
      ],
    },
  ],
  publishers: [
    { name: "Harper Collins Publishers", count: 30 },
    { name: "New Directions", count: 24 },
    { name: "Bloomsbury", count: 23 },
  ],
  pairs: [
    {
      author: "Paulo Coelho",
      translator: "Margaret Jull Costa",
      count: 17,
    },
    {
      author: "Clarice Lispector",
      translator: "Giovanni Pontiero",
      count: 9,
    },
    {
      author: "Milton Hatoum",
      translator: "John Gledson",
      count: 8,
    },
    {
      author: "Moacyr Scliar",
      translator: "Eloah F. Giacomelli",
      count: 8,
    },
    {
      author: "Paulo Coelho",
      translator: "Alan R. Clarke",
      count: 8,
    },
    {
      author: "Luis Alfredo Garcia-Roza",
      translator: "Benjamin Moser",
      count: 7,
    },
  ],
  countries: [
    {
      code: "US",
      count: 260,
    },
    {
      code: "GB",
      count: 142,
    },
    {
      code: "CA",
      count: 11,
    },
    {
      code: "AU",
      count: 5,
    },
  ],
  retranslated: [
    {
      title: "Dom Casmurro",
      authors: ["Machado de Assis"],
      translations: 3,
      publications: 4,
      timeline: [
        {
          year: 1953,
          translators: ["Helen Caldwell"],
        },
        {
          year: 1966,
          translators: ["R. L. Scott-Buccleuch"],
        },
        {
          year: 1997,
          translators: ["John Gledson"],
        },
      ],
    },
    {
      title: "Memórias póstumas de Brás Cubas",
      authors: ["Machado de Assis"],
      translations: 3,
      publications: 4,
      timeline: [
        {
          year: 1952,
          translators: ["William L. Grossman"],
        },
        {
          year: 1955,
          translators: ["E. Percy Ellis"],
        },
        {
          year: 1997,
          translators: ["Gregory Rabassa"],
        },
      ],
    },
  ],
  sourced: 3,
  matched: null,
};

/** Insights for a search that matched nothing. */
const NOTHING: Insights = {
  publications: 0,
  years: null,
  annual: { countries: [], years: [] },
  decades: [],
  debuts: [],
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
  pairs: [],
  countries: [],
  retranslated: [],
  sourced: 0,
  matched: [],
};

export { INSIGHTS, NOTHING };

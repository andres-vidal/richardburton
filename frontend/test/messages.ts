import written from "messages/en.json";

/** Enough countries to render a field. What a term finds is the server's, and
 * is checked there. */
const COUNTRIES = [
  { id: "AU", label: "Australia", numeric: "036" },
  { id: "BR", label: "Brazil", numeric: "076" },
  { id: "CA", label: "Canada", numeric: "124" },
  { id: "GB", label: "United Kingdom", article: "the", numeric: "826" },
  { id: "NL", label: "Netherlands", article: "the", numeric: "528" },
  { id: "US", label: "United States", article: "the", numeric: "840" },
];

/** The numeric ISO code of each country in `COUNTRIES`, to its alpha-2 code. */
const NUMERIC_CODES = Object.fromEntries(
  COUNTRIES.map(({ id, numeric }) => [numeric, id]),
);

/**
 * The messages a story or a spec reads: `messages/en.json`, plus the country
 * catalogues a running app fetches from the backend — see `i18n/request`.
 */
const messages = {
  ...written,
  countryNames: Object.fromEntries(COUNTRIES.map((c) => [c.id, c.label])),
  countryArticles: Object.fromEntries(
    COUNTRIES.filter((c) => c.article).map((c) => [c.id, c.article as string]),
  ),
};

export { COUNTRIES, NUMERIC_CODES, messages };

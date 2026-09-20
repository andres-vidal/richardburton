import written from "messages/en.json";

/** Enough countries to render a field. What a term finds is the server's, and
 * is checked there. */
const COUNTRIES = [
  { id: "BR", label: "Brazil" },
  { id: "CA", label: "Canada" },
  { id: "NL", label: "Netherlands", article: "the" },
  { id: "US", label: "United States", article: "the" },
];

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

export { COUNTRIES, messages };

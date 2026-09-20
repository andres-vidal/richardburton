import written from "messages/en.json";

/**
 * A handful of countries, the way the server names them.
 *
 * Which countries a term finds, and what each is called, are settled on the
 * server and checked in its own specs. A story or a spec needs only enough of
 * them to render a field, so it gets these.
 */
const COUNTRIES = [
  { id: "BR", label: "Brazil" },
  { id: "CA", label: "Canada" },
  { id: "NL", label: "Netherlands", article: "the" },
  { id: "US", label: "United States", article: "the" },
];

/**
 * The messages a story or a spec reads.
 *
 * `messages/en.json` outside a running app, plus the two country catalogues
 * that a running app reads from the backend — see `i18n/request`. A component
 * that names a country reads it from these, so it has to be given them here
 * too.
 */
const messages = {
  ...written,
  countryNames: Object.fromEntries(COUNTRIES.map((c) => [c.id, c.label])),
  countryArticles: Object.fromEntries(
    COUNTRIES.filter((c) => c.article).map((c) => [c.id, c.article as string]),
  ),
};

export { COUNTRIES, messages };

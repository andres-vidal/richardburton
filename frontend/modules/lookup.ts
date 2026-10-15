import { request } from "app";

/** A country as it is stored and as it is read: the code, and its name. */
type Country = { id: string; label: string };

/**
 * A book in the language it was written in: its title and its authors. A
 * publication translates one, and the pair is part of the publication's
 * composite key, so the two fields are looked up together.
 */
type OriginalBook = { title: string; authors: string[] };

/** Returns the body of a GET request to the API at `path` with `params`. */
async function get<T>(path: string, params: Record<string, string>) {
  return request(async (http) => (await http.get<T>(path, { params })).data);
}

/**
 * The searches that suggest values for a field from the values already in the
 * database. Each one returns what the server finds for `term`:
 *
 * - `authors` returns the names of translators and original authors.
 * - `publishers` returns the names of publishers.
 * - `originalBooks` returns the original books whose title or one of whose
 *   authors matches the term.
 * - `countries` returns the countries the term finds by either ISO code, by
 *   their name in either language, or by an alias. Each country is named in
 *   `locale`.
 *
 * The searches are properties of one object so that a test or a story can
 * replace any of them with a stub.
 */
const LOOKUP = {
  authors: (term: string) => get<string[]>("/authors", { search: term }),
  publishers: (term: string) => get<string[]>("/publishers", { search: term }),
  originalBooks: (term: string) =>
    get<OriginalBook[]>("/original-books", { search: term }),
  countries: (term: string, locale: string) =>
    get<Country[]>("/countries", { search: term, locale }),
};

export { LOOKUP };
export type { Country, OriginalBook };

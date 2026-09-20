import { request } from "app";

/**
 * A country as both the things that travel: the code a publication stores, the
 * name a reader is shown, and the article that name takes in a sentence.
 *
 * Which article a name takes is a property of the name, so it differs by
 * language and comes from the server with the name. A name that takes no
 * article has none.
 */
type Country = { id: string; label: string; article?: string | null };

/**
 * Every country, named in one language, by the code a publication stores.
 *
 * The server is the only place countries are named, so the name a reader is
 * shown is the very name the search matches on. This holds what it answered, so
 * a cell can turn a code into a name while it renders rather than waiting on a
 * request. The names are the same for every reader of a language, which is why
 * one cache serves them all.
 */
const NAMED_BY_LOCALE = new Map<string, Record<string, Country>>();

/**
 * Takes in the countries the server named, for the language it named them in.
 *
 * Called where a page is assembled, before anything that shows a country
 * renders. A language already taken in keeps the names it has: the names do not
 * change while the app is running, so a second call carries the same list the
 * first one did.
 */
function setCountryNames(countries: Country[], locale: string): void {
  if (NAMED_BY_LOCALE.has(locale)) return;

  NAMED_BY_LOCALE.set(
    locale,
    Object.fromEntries(countries.map((country) => [country.id, country])),
  );
}

function named(code: string, locale: string): Country | undefined {
  return NAMED_BY_LOCALE.get(locale)?.[code];
}

/**
 * Every country, named in `locale`, in the order the server put them — which is
 * alphabetical by the name that language calls them.
 */
function countriesIn(locale: string): Record<string, Country> {
  return NAMED_BY_LOCALE.get(locale) ?? {};
}

/** What a country code is called in `locale`, or nothing where it names none. */
function countryName(code: string, locale: string): string | undefined {
  return named(code, locale)?.label;
}

/**
 * The article `code` takes in `locale`, or an empty string where its name takes
 * none. What a caller does with it is `publication.inCountry`'s business.
 */
function countryArticle(code: string, locale: string): string {
  return named(code, locale)?.article ?? "";
}

interface CountryModule {
  REMOTE: {
    /**
     * The countries a term finds, named in `locale`.
     *
     * Asked of the server rather than worked out here, so the field offers a
     * country by every name the search would find it under: either ISO code,
     * the name in any language, or one of the other names readers type for it.
     */
    search(term: string, locale: string): Promise<Country[]>;
    /** Every country, named in `locale`. */
    all(locale: string): Promise<Country[]>;
  };
}

const Country: CountryModule = {
  REMOTE: {
    search(term, locale) {
      return request(async (http) => {
        const { data } = await http.get<Country[]>("/countries", {
          params: { search: term, locale },
        });

        return data;
      });
    },

    all(locale) {
      return request(async (http) => {
        const { data } = await http.get<Country[]>("/countries", {
          params: { locale },
        });

        return data;
      });
    },
  },
};

export {
  // Both the type and the module, as `Author` and `Publisher` are exported.
  Country,
  countriesIn,
  countryArticle,
  countryName,
  setCountryNames,
};

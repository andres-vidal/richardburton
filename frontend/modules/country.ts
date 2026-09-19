import { request } from "app";

/** A country as it is stored and as it is read: the code, and its name. */
type Country = { id: string; label: string };

/** A country as the server names it, with the article its name takes. */
type NamedCountry = Country & { article?: string | null };

/**
 * Every country, named in one language, by the code a publication stores.
 *
 * The server is the only place countries are named, so the name a reader is
 * shown is the very name the search matches on. This holds what it answered, so
 * a cell can turn a code into a name while it renders rather than waiting on a
 * request. The names are the same for every reader of a language, which is why
 * one cache serves them all.
 */
const NAMED_BY_LOCALE = new Map<string, Record<string, NamedCountry>>();

/**
 * Take in the countries the server named, for the language it named them in.
 *
 * Called where a page is assembled, before anything that shows a country
 * renders. A language taken in twice keeps what it was given last.
 */
function rememberCountries(locale: string, countries: NamedCountry[]): void {
  NAMED_BY_LOCALE.set(
    locale,
    Object.fromEntries(countries.map((country) => [country.id, country])),
  );
}

/** Whether the countries for a language have been taken in yet. */
function knowsCountries(locale: string): boolean {
  return NAMED_BY_LOCALE.has(locale);
}

function named(code: string, locale: string): NamedCountry | undefined {
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
    all(locale: string): Promise<NamedCountry[]>;
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
        const { data } = await http.get<NamedCountry[]>("/countries", {
          params: { locale },
        });

        return data;
      });
    },
  },
};

export type { NamedCountry };
export {
  // Both the type and the module, as `Author` and `Publisher` are exported.
  Country,
  countriesIn,
  countryArticle,
  countryName,
  knowsCountries,
  rememberCountries,
};

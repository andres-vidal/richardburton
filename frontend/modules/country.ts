import { request } from "app";

/** A country as it is stored and as it is read: the code, and its name. */
type Country = { id: string; label: string };

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
  },
};

// Both the type and the module, as `Author` and `Publisher` are exported.
export { Country };

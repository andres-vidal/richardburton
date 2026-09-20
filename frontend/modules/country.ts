import { request } from "app";

/** A country as it is stored and as it is read: the code, and its name. */
type Country = { id: string; label: string };

interface CountryModule {
  REMOTE: {
    /**
     * The countries a term finds, named in `locale`.
     *
     * Asked of the server, so the field offers a country under every name the
     * search would find it by: either ISO code, either language, or an alias.
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

export { Country };

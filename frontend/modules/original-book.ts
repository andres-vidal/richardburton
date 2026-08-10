import { request } from "app";

/**
 * A book in the language it was written in: a title and who wrote it, together.
 * The pair is what a publication translates, and what the composite key is
 * built from, so the two travel as a unit rather than as two fields that happen
 * to sit side by side.
 */
type OriginalBook = {
  title: string;
  /** The authors as the one comma-separated string the field holds. */
  authors: string;
};

interface OriginalBookModule {
  REMOTE: {
    search(term: string): Promise<OriginalBook[]>;
  };
}

const OriginalBook: OriginalBookModule = {
  REMOTE: {
    search(term) {
      return request(async (http) => {
        const { data } = await http.get<OriginalBook[]>("/original-books", {
          params: { search: term },
        });

        return data;
      });
    },
  },
};

export { OriginalBook };
export type { OriginalBook as OriginalBookValue };

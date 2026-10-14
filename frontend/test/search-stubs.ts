import { Author } from "modules/author";
import { Country } from "modules/country";
import { OriginalBook } from "modules/original-book";
import { Publisher } from "modules/publisher";

/**
 * Replaces `REMOTE.search` for authors, publishers, original books and
 * countries with stubs that make no network request.
 *
 * The author, publisher and original-book searches return no results. The
 * country search returns the entries of `countries` whose label contains the
 * term, ignoring case, so it returns no results when `countries` is empty.
 */
function stubSearches(countries: { id: string; label: string }[] = []): void {
  Author.REMOTE.search = async () => [];
  Publisher.REMOTE.search = async () => [];
  OriginalBook.REMOTE.search = async () => [];
  Country.REMOTE.search = async (term) =>
    countries.filter((country) =>
      country.label.toLowerCase().includes(term.toLowerCase()),
    );
}

export { stubSearches };

import { Author } from "modules/author";
import { Country } from "modules/country";
import { OriginalBook } from "modules/original-book";
import { Publisher } from "modules/publisher";

/**
 * Stubs `REMOTE.search` for authors, publishers, original books and countries,
 * so it returns no results and makes no network request.
 *
 * The suggesting fields debounce their search, so a spec can finish with a
 * search still pending. That search would then run after the test environment
 * is torn down, where there is no `XMLHttpRequest`. The unhandled rejection
 * fails the run even though every test passed.
 *
 * A spec that needs results stubs `search` itself, and afterwards restores this
 * stub rather than the real call.
 */
Author.REMOTE.search = async () => [];
Publisher.REMOTE.search = async () => [];
OriginalBook.REMOTE.search = async () => [];
Country.REMOTE.search = async () => [];

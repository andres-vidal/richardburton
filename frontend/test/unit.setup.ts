import { Author } from "modules/author";
import { Country } from "modules/country";
import { OriginalBook } from "modules/original-book";
import { Publisher } from "modules/publisher";

/**
 * No unit test reaches the network.
 *
 * The suggesting fields debounce, so a spec can finish with a request still to
 * be made. It then fires after the test has been torn down, in an environment
 * with no `XMLHttpRequest` — an unhandled rejection that fails the run while
 * every test passes, which is as confusing a failure as it sounds.
 *
 * Answering with nothing here means there is no request to be left over. A spec
 * that wants an answer stubs one, and puts a stub back rather than the real
 * call.
 */
Author.REMOTE.search = async () => [];
Publisher.REMOTE.search = async () => [];
OriginalBook.REMOTE.search = async () => [];
Country.REMOTE.search = async () => [];

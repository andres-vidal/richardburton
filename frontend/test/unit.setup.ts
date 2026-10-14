import { stubLookups } from "./search-stubs";

/**
 * Stubs every search in `LOOKUP`, so a field that suggests values returns no
 * results and makes no network request.
 *
 * A request made by a spec could still be in flight when the test environment
 * is torn down, where there is no `XMLHttpRequest`. The unhandled rejection
 * would then fail the run even though every test passed.
 *
 * A spec that needs results stubs a search itself, and afterwards restores this
 * stub rather than the real call.
 */
stubLookups();

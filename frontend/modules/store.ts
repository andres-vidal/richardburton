import { createStore } from "jotai";

/**
 * A Jotai store — the handle the imperative actions and the remote layer write
 * through. Named so they can take one as an argument instead of reaching for a
 * module-level singleton: which store a call belongs to is then part of the call.
 */
export type Store = ReturnType<typeof createStore>;

/**
 * The app-global store, for state that is genuinely app-wide (notifications).
 * Publication state lives in its own store, provided per workspace — see
 * `PublicationStoreProvider`.
 */
export const store: Store = createStore();

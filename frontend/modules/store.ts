import { createStore } from "jotai";

/**
 * A Jotai store. The actions and the remote layer take the store they write as
 * an argument, rather than writing a module-level store.
 */
export type Store = ReturnType<typeof createStore>;

/**
 * The store for state that belongs to the whole app, such as notifications.
 * Publication state is in a store of each surface's own; see
 * `PublicationStoreProvider`.
 */
export const store: Store = createStore();

import { createStore } from "jotai";

/**
 * The single Jotai store for the whole app. Provided to the React tree via
 * `<Provider store={store}>` in `pages/_app`, read by hooks (through the
 * Provider) and written by the imperative actions + remote layer — so
 * subscriptions and imperative writes always hit the same store.
 */
export const store = createStore();

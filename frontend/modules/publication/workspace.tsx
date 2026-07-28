"use client";

import { Provider, createStore } from "jotai";
import type { Store } from "modules/store";
import { createContext, FC, ReactNode, useContext, useState } from "react";
import invariant from "tiny-invariant";

const PublicationStoreContext = createContext<Store | null>(null);

const OwnPublicationStore: FC<{
  store?: Store;
  initialize?: (store: Store) => void;
  children: ReactNode;
}> = ({ store: provided, initialize, children }) => {
  const [store] = useState(() => {
    const store = provided ?? createStore();
    initialize?.(store);
    return store;
  });

  return (
    <PublicationStoreContext.Provider value={store}>
      <Provider store={store}>{children}</Provider>
    </PublicationStoreContext.Provider>
  );
};

/**
 * Ensure this subtree has publication state to work in.
 *
 * Publication state is a *working set* — rows loaded, edits pending, rows
 * selected, columns hidden — so it belongs to whatever surface is doing the
 * work, not to the application. A surface that needs one renders this around
 * itself, so nothing above it has to know that it does: needing a store is the
 * component's own business, not a condition it puts on its callers.
 *
 * It **joins** an existing store rather than shadowing it. That is what lets a
 * publication's view be both things at once: on its own page it owns the state
 * it edits, and in the overlay over the catalogue it edits the catalogue's, so
 * the row behind it changes with it. Two surfaces that are *not* nested get a
 * store each, and cannot see each other's edits.
 *
 * Reads need nothing: the hooks in `./hooks` resolve this store through Jotai's
 * own provider. Writes name it, because the actions and the remote layer are
 * plain functions called from event handlers rather than hooks — they take the
 * store as their first argument, and `usePublicationStore` is how a component
 * hands them the right one.
 */
const PublicationStoreProvider: FC<{
  /**
   * A store to use as-is, for a caller that has to seed state before the tree
   * renders (a story's `beforeEach`, a spec). Always wins.
   */
  store?: Store;
  /**
   * The state this surface starts in, written once before anything renders. A
   * starting state belongs to the store, not to an effect that puts it there
   * after the first paint — and writing to a store nobody has subscribed to yet
   * is safe, which is what makes this different from seeding a shared one.
   */
  initialize?: (store: Store) => void;
  children: ReactNode;
}> = ({ store, initialize, children }) => {
  const joined = useContext(PublicationStoreContext);

  return store || !joined ? (
    <OwnPublicationStore store={store} initialize={initialize}>
      {children}
    </OwnPublicationStore>
  ) : (
    <>{children}</>
  );
};

/** The store of the surface this component renders in. */
function usePublicationStore(): Store {
  const store = useContext(PublicationStoreContext);

  invariant(
    store,
    "No publication store: render this inside <PublicationStoreProvider>.",
  );

  return store;
}

export { PublicationStoreProvider, usePublicationStore };

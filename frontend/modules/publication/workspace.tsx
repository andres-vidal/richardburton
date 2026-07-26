"use client";

import { Provider, createStore } from "jotai";
import type { Store } from "modules/store";
import { createContext, ReactNode, useContext, useState } from "react";

const PublicationStoreContext = createContext<Store | null>(null);

/**
 * A workspace's own publication state.
 *
 * Publication state is a *working set* — rows loaded, edits pending, rows
 * selected, columns hidden — so it belongs to whatever surface is doing the work,
 * not to the application. Each provider owns a store of its own: two workspaces
 * on screen cannot see each other's edits, and a story or a spec gets a clean
 * one per render instead of resetting a shared singleton.
 *
 * Reads need nothing: the hooks in `./hooks` resolve this store through Jotai's
 * own provider. Writes name it, because the actions and the remote layer are
 * plain functions called from event handlers rather than hooks — they take the
 * store as their first argument, and `usePublicationStore` is how a component
 * hands them the right one.
 *
 * `store` is for a caller that has to seed the state before the tree renders
 * (a story's `beforeEach`, a spec); otherwise one is created here.
 */
function PublicationStoreProvider({
  store: provided,
  children,
}: {
  store?: Store;
  children: ReactNode;
}) {
  const [store] = useState(() => provided ?? createStore());

  return (
    <PublicationStoreContext.Provider value={store}>
      <Provider store={store}>{children}</Provider>
    </PublicationStoreContext.Provider>
  );
}

/** The store of the workspace this component renders in. */
function usePublicationStore(): Store {
  const store = useContext(PublicationStoreContext);

  if (!store) {
    throw new Error(
      "No publication store: render this inside <PublicationStoreProvider>.",
    );
  }

  return store;
}

/** A store to seed and then hand to the provider. */
function createPublicationStore(): Store {
  return createStore();
}

export {
  PublicationStoreProvider,
  createPublicationStore,
  usePublicationStore,
};

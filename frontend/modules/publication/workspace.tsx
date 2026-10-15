"use client";

import { Provider, createStore } from "jotai";
import type { Store } from "modules/store";
import {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import invariant from "tiny-invariant";

import { receiveIndex, type PublicationIndex } from "./store";

const PublicationStoreContext = createContext<Store | null>(null);

/** The props `PublicationStoreProvider` takes. */
type Props = {
  /**
   * A store to use as it is, for a caller that has to write to the store
   * before the tree renders, such as a story's `beforeEach` or a spec.
   */
  store?: Store;
  /**
   * The rows the surface shows: a page of the database read on the server.
   * The provider writes it with `receiveIndex` before anything renders, and
   * writes it again each time a different object is passed.
   */
  index?: PublicationIndex;
  /**
   * Writes the state the surface starts in, once, before anything renders.
   * Writing to a store nobody subscribes to yet is safe, and nothing renders
   * from an empty store first.
   */
  initialize?: (store: Store) => void;
  children: ReactNode;
};

/**
 * Provides a store of its own to its children: `store` when it is given, or a
 * new one. It writes `index` and runs `initialize` once before its children
 * render, and writes `index` again whenever a different object is passed.
 */
const OwnPublicationStore: FC<Props> = ({
  store: provided,
  index,
  initialize,
  children,
}) => {
  const [store] = useState(() => {
    const store = provided ?? createStore();
    if (index) receiveIndex(store, index);
    initialize?.(store);
    return store;
  });

  // The index last written. The first one is written above, before the
  // children render.
  const received = useRef(index);

  useEffect(() => {
    if (!index || received.current === index) return;

    received.current = index;
    receiveIndex(store, index);
  }, [store, index]);

  return (
    <PublicationStoreContext.Provider value={store}>
      <Provider store={store}>{children}</Provider>
    </PublicationStoreContext.Provider>
  );
};

/**
 * Gives its children a publication store: the rows loaded, the edits pending,
 * the rows selected and the columns hidden of one surface.
 *
 * A provider inside another provider joins the outer store rather than making
 * its own, unless it is given `store`. That way a publication opened over the
 * database edits the database's rows, and the row behind it changes with it,
 * while on its own page the same view has a store of its own. Two surfaces
 * that are not nested have a store each and do not see each other's edits.
 * A provider that joins an outer store ignores `index` and `initialize`.
 *
 * The hooks in `./hooks` read the store through Jotai's provider. The actions
 * and the remote layer are plain functions that take the store as their first
 * argument, and `usePublicationStore` returns the store to pass them.
 */
const PublicationStoreProvider: FC<Props> = ({
  store,
  index,
  initialize,
  children,
}) => {
  const joined = useContext(PublicationStoreContext);

  return store || !joined ? (
    <OwnPublicationStore store={store} index={index} initialize={initialize}>
      {children}
    </OwnPublicationStore>
  ) : (
    <>{children}</>
  );
};

/**
 * Returns the store of the nearest `PublicationStoreProvider`. Throws when
 * there is none.
 */
function usePublicationStore(): Store {
  const store = useContext(PublicationStoreContext);

  invariant(
    store,
    "No publication store: render this inside <PublicationStoreProvider>.",
  );

  return store;
}

export { PublicationStoreProvider, usePublicationStore };

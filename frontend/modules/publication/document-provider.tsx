"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { keepDraft } from "./draft";
import { live, type Live, type LiveState } from "./document-live";
import { sync, type SyncState } from "./document-sync";
import { LiveProvider } from "./presence";
import { validate } from "./remote";
import { openWorkspace, publicationIdsAtom } from "./store";
import { usePublicationStore } from "./workspace";

/**
 * Opens the import document `document` and binds the enclosing publication
 * store to it.
 *
 * It creates a Yjs document and binds the store to it with `openWorkspace`.
 * Components still read the store's atoms. An observer copies the document
 * into the atoms, and never copies the atoms back. The document is kept in
 * three places:
 *
 * - `y-indexeddb` stores it in this browser's IndexedDB, so the work survives
 *   closing the tab and can be edited while the server is unreachable.
 * - `sync` posts its updates to the server, so the same work opens on any
 *   machine.
 * - `live` relays its changes over the document's channel, so everyone with it
 *   open sees each change as it is made.
 *
 * The draft row is kept in `localStorage` by `keepDraft`, not in the document,
 * because it holds one person's unfinished typing. Validation results are not
 * stored. Rows are validated again once the document has loaded.
 *
 * The effect depends only on the store and `document`. Tearing down the
 * document and its connections for any other reason would lose what had been
 * typed in the meantime.
 */
const DocumentProvider: FC<{ document: number; children: ReactNode }> = ({
  document: id,
  children,
}) => {
  const store = usePublicationStore();

  const [attached, setAttached] = useState<Omit<Live, "stop">>();
  const [connection, setConnection] = useState<LiveState>("connecting");
  const [saving, setSaving] = useState<SyncState>("saved");

  useEffect(() => {
    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);
    const stored = new IndexeddbPersistence(`document-${id}`, doc);
    const running = sync(doc, id, {
      onStatus: setSaving,
      loaded: stored.whenSynced,
    });

    const relayed = live(doc, id, {
      onStatus: setConnection,
      onRejoin: () => running.resync(),
      ready: running.ready,
    });

    setAttached({ awareness: relayed.awareness, presence: relayed.presence });

    const forgetDraft = keepDraft(store, `document-${id}`);

    // Validation errors are not stored with the rows, so the rows of a
    // reopened document have none. Without validating them again, every row
    // would count as valid, and rows the database will refuse could be
    // submitted.
    //
    // Nothing waits on this promise, and validation fails while the server is
    // unreachable, so the rejection is caught here instead of going unhandled.
    Promise.all([stored.whenSynced, running.ready])
      .then(() => {
        const ids = store.get(publicationIdsAtom);

        return ids && ids.length > 0 ? validate(store, ids) : undefined;
      })
      .catch(() => {});

    return () => {
      setAttached(undefined);
      relayed.stop();
      running.stop();
      forgetDraft();
      close();
      stored.destroy();
      doc.destroy();
    };
  }, [store, id]);

  // The children render only once `attached` is set, which happens in the same
  // effect that binds the store to the document. This delays them by one
  // render, so nothing can write a row into the atoms before the document is
  // bound.
  return attached ? (
    <LiveProvider
      awareness={attached.awareness}
      presence={attached.presence}
      connection={connection}
      saving={saving}
    >
      {children}
    </LiveProvider>
  ) : null;
};

export { DocumentProvider };

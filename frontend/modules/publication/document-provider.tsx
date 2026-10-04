"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { watchChecks } from "./checks";
import { keepDraft } from "./draft";
import { live, type Live, type LiveState } from "./document-live";
import { sync, type SyncState } from "./document-sync";
import { LiveProvider } from "./presence";
import { openWorkspace } from "./store";
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
 * because it holds one person's unfinished typing.
 *
 * `watchChecks` validates the rows and runs the look-alike check as the
 * document changes, and stores the results in the document. Once the document
 * has loaded, every row is checked again, because a stored result can
 * be out of date with the database. For example, another document may have
 * inserted the same publication since.
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
    const checks = watchChecks(store, doc);

    // `running.ready` rejects when the server is unreachable. The stored
    // results are then kept until the next change is checked.
    Promise.all([stored.whenSynced, running.ready])
      .then(() => checks.refresh())
      .catch(() => {});

    return () => {
      setAttached(undefined);
      checks.stop();
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

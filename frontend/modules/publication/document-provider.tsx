"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { keepDraft } from "./draft";
import { live, type Live, type LiveState } from "./document-live";
import { sync, type SyncState } from "./document-sync";
import { LiveProvider } from "./presence";
import { validate } from "./remote";
import { openWorkspace, visibleIdsAtom } from "./store";
import { usePublicationStore } from "./workspace";

/**
 * Put this surface's content in an import document.
 *
 * Every store keeps its rows in a Yjs document. This one hands the store the
 * import document's, which is what lets the rows be the same ones several
 * people are editing and be written to disk as opaque updates. The atoms are
 * still what everything reads: one observer writes the content into them, and
 * nothing writes back.
 *
 * Three things keep it: `y-indexeddb` on this browser's disk, so the work
 * survives the tab and can be edited with the server unreachable; the server,
 * so it is the same work on any machine; and the channel, so everyone with it
 * open sees a change as it happens.
 *
 * The draft row is kept apart, since it is one person's unfinished typing
 * rather than content the document holds. Whether a row was ever validated is
 * not kept at all: it is what the server last said, and a document picked up
 * hours later asks again.
 *
 * The document is built once for the document being opened, and depends on
 * nothing else: tearing down a document and its connections for any other
 * reason would throw away whatever had been typed in the meantime.
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

    // Rows restored from disk carry no word on whether they are valid: that was
    // the server's, and it was never written down. Without asking again, a
    // resumed document would call every row valid and offer to submit rows the
    // database will refuse.
    //
    // Nothing waits on the answer, and one opened with the server out of reach
    // cannot get one, so the rejection is answered here rather than left to
    // escape.
    Promise.all([stored.whenSynced, running.ready])
      .then(() => {
        const ids = store.get(visibleIdsAtom);

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

  // Held back for one paint, so nothing can write a row into the atoms before
  // the document is the place rows go. What is attached is set in the same
  // effect that attaches the document, so having it is what says it is.
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

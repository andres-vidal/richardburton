"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import type { Awareness } from "y-protocols/awareness";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { useSession } from "modules/session";

import { LOCAL } from "./doc";
import { keepDraft } from "./draft";
import { live } from "./document-live";
import { sync } from "./document-sync";
import { LiveProvider } from "./presence";
import { validate } from "./remote";
import { openWorkspace, visibleIdsAtom } from "./store";
import { usePublicationStore } from "./workspace";

/**
 * Put this surface's content in an import document.
 *
 * The content is a Yjs document rather than atoms alone, which is what lets it
 * be the same content several people are editing and be written to disk as
 * opaque updates. The atoms are still what everything reads: one observer
 * writes the content into them, and nothing writes back.
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
 */
const DocumentProvider: FC<{ document: number; children: ReactNode }> = ({
  document: id,
  children,
}) => {
  const store = usePublicationStore();
  const session = useSession();
  const email = session?.email;

  const [attached, setAttached] = useState(false);
  const [awareness, setAwareness] = useState<Awareness | undefined>();

  useEffect(() => {
    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);
    const stored = new IndexeddbPersistence(`document-${id}`, doc);
    const running = sync(doc, id);

    // Only a change made here crosses to the others. One that arrived — from
    // the stored updates or from someone else — carries its own origin, so
    // relaying it back would put it round the room forever.
    const relayed = live(doc, id, (origin) => origin === LOCAL);

    // Who this is, so everyone else's list of who is here can name them.
    if (email) relayed.awareness.setLocalStateField("user", { email });
    setAwareness(relayed.awareness);

    const forgetDraft = keepDraft(store, `document-${id}`);

    setAttached(true);

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
      setAttached(false);
      setAwareness(undefined);
      relayed.stop();
      running.stop();
      forgetDraft();
      close();
      stored.destroy();
      doc.destroy();
    };
  }, [store, id, email]);

  // Held back for one paint, so nothing can write a row into the atoms before
  // the document is the place rows go.
  return attached ? (
    <LiveProvider value={{ awareness }}>{children}</LiveProvider>
  ) : null;
};

export { DocumentProvider };

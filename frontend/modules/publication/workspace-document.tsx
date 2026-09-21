"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { keepDraft } from "./draft";
import { validate } from "./remote";
import { openWorkspace, visibleIdsAtom } from "./store";
import { usePublicationStore } from "./workspace";
import { sync } from "./workspace-sync";

/**
 * The workspace a browser keeps to itself, for work not yet given a name.
 */
const LOCAL_WORKSPACE = "publications-new";

/**
 * Keep this surface's content in a document that outlives the tab.
 *
 * The content is a Yjs document rather than atoms alone, which is what lets it
 * be written to disk as opaque updates and be the same document two people are
 * editing. The atoms are still what everything reads: one observer writes the
 * document into them, and nothing writes back.
 *
 * `y-indexeddb` replays what it stored as soon as it opens, so reopening the
 * page finds the rows where they were left — without the network. Given a
 * `workspace`, the document is also kept in step with the server's copy, and
 * disk becomes the offline cache rather than the only home.
 *
 * The draft row is kept separately, since it is one person's unfinished typing
 * rather than content the workspace holds. Whether a row was ever validated is
 * not kept at all: it is what the server last said, and a workspace picked up
 * hours later asks again.
 */
const WorkspaceDocument: FC<{
  /**
   * The workspace on the server this belongs to. Left out, the document is this
   * browser's alone and never leaves it.
   */
  workspace?: number;
  children: ReactNode;
}> = ({ workspace, children }) => {
  const store = usePublicationStore();
  const [attached, setAttached] = useState(false);

  useEffect(() => {
    const name =
      workspace === undefined ? LOCAL_WORKSPACE : `workspace-${workspace}`;

    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);
    const stored = new IndexeddbPersistence(name, doc);
    const running = workspace === undefined ? undefined : sync(doc, workspace);
    const forgetDraft = keepDraft(store, name);

    setAttached(true);

    // Rows restored from disk carry no word on whether they are valid: that was
    // the server's, and it was never written down. Without asking again, a
    // resumed workspace would call every row valid and offer to submit rows the
    // database will refuse.
    //
    // Nothing waits on the answer, and a workspace opened with the server out of
    // reach cannot get one, so the rejection is answered here rather than left
    // to escape.
    Promise.all([stored.whenSynced, running?.ready])
      .then(() => {
        const ids = store.get(visibleIdsAtom);

        return ids && ids.length > 0 ? validate(store, ids) : undefined;
      })
      .catch(() => {});

    return () => {
      setAttached(false);
      running?.stop();
      forgetDraft();
      close();
      stored.destroy();
      doc.destroy();
    };
  }, [store, workspace]);

  // Held back for one paint, so nothing can write a row into the atoms before
  // the document is the place rows go.
  return attached ? <>{children}</> : null;
};

export { WorkspaceDocument, LOCAL_WORKSPACE };

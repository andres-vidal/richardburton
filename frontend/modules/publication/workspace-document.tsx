"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { openWorkspace } from "./store";
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
    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);
    const stored = new IndexeddbPersistence(
      workspace === undefined ? LOCAL_WORKSPACE : `workspace-${workspace}`,
      doc,
    );
    const running = workspace === undefined ? undefined : sync(doc, workspace);

    setAttached(true);

    return () => {
      setAttached(false);
      running?.stop();
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

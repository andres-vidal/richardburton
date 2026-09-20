"use client";

import { IndexeddbPersistence } from "y-indexeddb";
import { FC, ReactNode, useEffect, useState } from "react";
import * as Y from "yjs";

import { openWorkspace } from "./store";
import { usePublicationStore } from "./workspace";

/**
 * The one workspace a browser keeps locally, until a workspace is a thing the
 * server names.
 */
const LOCAL_WORKSPACE = "publications-new";

/**
 * Keep this surface's content in a document that outlives the tab.
 *
 * The content is a Yjs document rather than atoms alone, which is what lets it
 * be written to disk as opaque updates and, later, be the same document two
 * people are editing. The atoms are still what everything reads: one observer
 * writes the document into them, and nothing writes back.
 *
 * `y-indexeddb` replays what it stored into the document as soon as it opens,
 * so reopening the page finds the rows where they were left. Nothing here
 * reaches the network — the work survives the tab with the backend switched
 * off entirely.
 */
const WorkspaceDocument: FC<{
  /** Which stored document to open. One per browser for now. */
  name?: string;
  children: ReactNode;
}> = ({ name = LOCAL_WORKSPACE, children }) => {
  const store = usePublicationStore();
  const [attached, setAttached] = useState(false);

  useEffect(() => {
    const doc = new Y.Doc();
    const close = openWorkspace(store, doc);
    const stored = new IndexeddbPersistence(name, doc);

    setAttached(true);

    return () => {
      setAttached(false);
      close();
      stored.destroy();
      doc.destroy();
    };
  }, [store, name]);

  // Held back for one paint, so nothing can write a row into the atoms before
  // the document is the place rows go.
  return attached ? <>{children}</> : null;
};

export { WorkspaceDocument, LOCAL_WORKSPACE };

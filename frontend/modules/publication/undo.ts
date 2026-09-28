"use client";

import { useCallback, useEffect, useState } from "react";

import { documentOf } from "./store";
import { usePublicationStore } from "./workspace";

/** What a workspace can walk back, and how. */
type Undo = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

/**
 * Walk back the edits made here, and only those.
 *
 * A workspace is shared, so undo is not: taking back your last change must not
 * take back what the person beside you just typed. The document tracks who made
 * each change, and this walks back the ones stamped as local.
 */
function useWorkspaceUndo(): Undo {
  const store = usePublicationStore();
  const manager = documentOf(store).undo;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    // Whether there is anything to walk back, rather than how much. Each is a
    // boolean set on its own, so an edit that leaves both where they were
    // re-renders nothing.
    const read = () => {
      setCanUndo(manager.undoStack.length > 0);
      setCanRedo(manager.redoStack.length > 0);
    };

    read();

    manager.on("stack-item-added", read);
    manager.on("stack-item-popped", read);
    manager.on("stack-cleared", read);

    return () => {
      manager.off("stack-item-added", read);
      manager.off("stack-item-popped", read);
      manager.off("stack-cleared", read);
    };
  }, [manager]);

  const undo = useCallback(() => manager.undo(), [manager]);
  const redo = useCallback(() => manager.redo(), [manager]);

  return { canUndo, canRedo, undo, redo };
}

export { useWorkspaceUndo };
export type { Undo };

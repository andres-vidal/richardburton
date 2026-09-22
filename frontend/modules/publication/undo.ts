"use client";

import { useCallback, useEffect, useState } from "react";

import { workspaceDoc } from "./store";
import { usePublicationStore } from "./workspace";

/** What a workspace can walk back, and how. */
type Undo = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

const NOTHING: Undo = {
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
};

/**
 * Walk back the edits made here, and only those.
 *
 * A workspace is shared, so undo is not: taking back your last change must not
 * take back what the person beside you just typed. The document tracks who made
 * each change, and this walks back the ones stamped as local.
 *
 * A surface with no document — the edit modal over the database — has nothing
 * to walk back, and says so rather than offering a button that does nothing.
 */
function useWorkspaceUndo(): Undo {
  const store = usePublicationStore();
  const workspace = workspaceDoc(store);
  const manager = workspace?.undo;

  const [depth, setDepth] = useState({ undo: 0, redo: 0 });

  useEffect(() => {
    if (!manager) return;

    const read = () =>
      setDepth({
        undo: manager.undoStack.length,
        redo: manager.redoStack.length,
      });

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

  const undo = useCallback(() => manager?.undo(), [manager]);
  const redo = useCallback(() => manager?.redo(), [manager]);

  return manager
    ? { canUndo: depth.undo > 0, canRedo: depth.redo > 0, undo, redo }
    : NOTHING;
}

export { useWorkspaceUndo };
export type { Undo };

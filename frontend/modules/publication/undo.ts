"use client";

import { useCallback, useEffect, useState } from "react";

import { documentOf } from "./store";
import { usePublicationStore } from "./workspace";

/** Whether a workspace can undo or redo, and the functions that do it. */
type Undo = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

/**
 * Returns undo and redo for the store's document, through its `Y.UndoManager`.
 *
 * The manager tracks only changes with the origin `LOCAL`. Undo therefore
 * reverts this person's edits and not those of other people editing the same
 * document.
 */
function useWorkspaceUndo(): Undo {
  const store = usePublicationStore();
  const manager = documentOf(store).undo;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    // Only whether each stack is empty is kept, not its size. Each is its own
    // boolean state, so an edit that leaves both unchanged does not re-render.
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

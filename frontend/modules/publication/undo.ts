"use client";

import { useCallback, useEffect, useState } from "react";
import { useHotkey } from "utils/useHotkey";

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

/** The input types a person types text into. */
const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

/**
 * The key combinations that undo: Ctrl+Z or Cmd+Z. Ctrl and Cmd may also be
 * held together, but Shift and Alt may not be held.
 */
const UNDO_KEYS = ["ctrl+meta?+z", "meta+z"];

/**
 * The key combinations that redo: Ctrl+Shift+Z, Cmd+Shift+Z or Ctrl+Y. Ctrl and
 * Cmd may also be held together, but Alt may not be held. Cmd+Y without Ctrl is
 * not one of them, since some Mac browsers open their history with it.
 */
const REDO_KEYS = ["ctrl+meta?+shift+z", "meta+shift+z", "ctrl+meta?+y"];

/**
 * Returns whether a key press on `target` belongs to the element: a text
 * field, which has its own undo for the text typed in it, or an element in an
 * open dialog.
 */
function ownsShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const isTextInput =
    target instanceof HTMLInputElement &&
    TEXT_INPUT_TYPES.has(target.type || "text");

  return (
    isTextInput ||
    target instanceof HTMLTextAreaElement ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !==
      null ||
    target.closest('[role="dialog"]') !== null
  );
}

/**
 * Runs `action` for a shortcut and stops the browser from acting on the key
 * press too. It does nothing when the press belongs to its target, as
 * `ownsShortcut` decides, or when an earlier listener has already called
 * `preventDefault` on it.
 */
function runShortcut(event: KeyboardEvent, action: () => void) {
  if (!event.defaultPrevented && !ownsShortcut(event.target)) {
    event.preventDefault();
    action();
  }
}

/**
 * Binds the undo shortcuts to `undo` and `redo` while the calling component is
 * mounted: `UNDO_KEYS` undo, and `REDO_KEYS` redo. A key press in a text field
 * or in an open dialog is left to the browser, so the text field keeps its own
 * undo for the text typed in it.
 */
function useUndoShortcuts({ undo, redo }: Pick<Undo, "undo" | "redo">): void {
  useHotkey(UNDO_KEYS, (event) => runShortcut(event, undo));
  useHotkey(REDO_KEYS, (event) => runShortcut(event, redo));
}

export { ownsShortcut, useUndoShortcuts, useWorkspaceUndo };

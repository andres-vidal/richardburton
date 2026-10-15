import { Editor, Transforms } from "slate";
import { ELEMENT_TO_NODE } from "slate-dom";
import { ReactEditor } from "slate-react";
import { expect, waitFor } from "storybook/test";

/** Returns the Slate editor that renders `textbox`. */
export function editorOf(textbox: HTMLElement): Editor {
  const editor = ELEMENT_TO_NODE.get(textbox);

  if (!Editor.isEditor(editor)) throw new Error("No Slate editor renders it");

  return editor;
}

/**
 * Waits until `textbox`, the element a Slate editor renders, has focus and its
 * editor holds a selection, so that the keys typed and the toolbar commands
 * given next act on that selection.
 */
export const editorSelected = (textbox: HTMLElement) =>
  waitFor(() => {
    expect(textbox).toHaveFocus();
    expect(editorOf(textbox).selection).not.toBeNull();
  });

/**
 * Focuses the Slate editor that renders `textbox` and waits until it holds a
 * selection. An editor without a selection gets the caret at the start of its
 * text.
 *
 * A play test focuses an editor this way rather than with a click. user-event
 * focuses the element and places the DOM selection in one step. Slate then
 * re-renders for the focus before it has read that DOM selection, and, finding
 * a focused editor without a selection, removes it. The editor is left without
 * a selection and ignores the keys typed next.
 */
export async function focusEditor(textbox: HTMLElement) {
  const editor = editorOf(textbox);

  if (!editor.selection) Transforms.select(editor, Editor.start(editor, []));
  ReactEditor.focus(editor);

  await editorSelected(textbox);
}

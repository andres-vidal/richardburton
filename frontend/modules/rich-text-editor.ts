import {
  Editor,
  Element,
  Node,
  Path,
  Point,
  Range,
  Text,
  Transforms,
  type NodeEntry,
} from "slate";
import {
  MAX_DEPTH,
  bareUrl,
  isLink,
  linkLabel,
  type LinkElement,
  type ListItemElement,
  type ListKind,
  type RichTextBlock,
  type RichTextMark,
  type RichTextValue,
} from "./rich-text";

/**
 * The editing commands of a rich-text editor, which work on a Slate editor
 * holding a rich-text value (see `modules/rich-text`), and `withRichText`,
 * which gives an editor the behaviour they rely on.
 *
 * The **selection** is the editor's own, or the range a command is given with
 * `at`, so a command can act on a selection saved before the focus left the
 * editor.
 */

/** Returns whether a node is a block: a paragraph or a list item. */
function isBlock(node: unknown): node is RichTextBlock {
  return (
    Element.isElement(node) &&
    (node.type === "paragraph" || node.type === "list-item")
  );
}

/** Returns whether a node is a list item. */
function isListItem(node: unknown): node is ListItemElement {
  return Element.isElement(node) && node.type === "list-item";
}

/** Returns whether the text typed next carries `mark`. */
function isMarkActive(editor: Editor, mark: RichTextMark): boolean {
  return Editor.marks(editor)?.[mark] === true;
}

/**
 * Adds `mark` to the selected text, or removes it when the text already
 * carries it. With a collapsed selection, it changes the marks of the text
 * typed next.
 */
function toggleMark(editor: Editor, mark: RichTextMark): void {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor, mark);
  else Editor.addMark(editor, mark, true);
}

/**
 * Returns the kind of list the selected blocks are items of, or null when
 * they are not all items of lists of one kind.
 */
function activeList(editor: Editor): ListKind | null {
  const blocks = [...Editor.nodes(editor, { match: isBlock })].map(
    ([node]) => node,
  );
  const [first] = blocks;

  return first?.type === "list-item" &&
    blocks.every((block) => isListItem(block) && block.list === first.list)
    ? first.list
    : null;
}

/**
 * Makes the selected blocks items of a list of `kind`, or paragraphs when they
 * already are. An item of a list of the other kind keeps its depth.
 */
function toggleList(editor: Editor, kind: ListKind): void {
  const blocks = [...Editor.nodes(editor, { match: isBlock })];
  const off = activeList(editor) === kind;

  Editor.withoutNormalizing(editor, () =>
    blocks.forEach(([block, path]) => {
      if (off) {
        Transforms.setNodes(editor, { type: "paragraph" }, { at: path });
        Transforms.unsetNodes(editor, ["list", "depth"], { at: path });
      } else {
        const depth = block.type === "list-item" ? block.depth : 0;
        Transforms.setNodes(
          editor,
          { type: "list-item", list: kind, depth },
          { at: path },
        );
      }
    }),
  );
}

/**
 * Moves the selected list items `step` levels deeper, or shallower for a
 * negative step. An item goes no shallower than the top level, and no deeper
 * than `MAX_DEPTH` or one level below the item before it. Returns whether the
 * selection holds a list item, whether or not one moved.
 */
function indent(editor: Editor, step: number): boolean {
  const items = [...Editor.nodes(editor, { match: isListItem })];

  Editor.withoutNormalizing(editor, () =>
    items.forEach(([, path]) => {
      const item = Node.get(editor, path) as ListItemElement;
      const before = Path.hasPrevious(path)
        ? Node.get(editor, Path.previous(path))
        : null;
      const limit = isListItem(before) ? before.depth + 1 : 0;
      const depth = Math.max(0, Math.min(item.depth + step, limit, MAX_DEPTH));

      Transforms.setNodes(editor, { depth }, { at: path });
    }),
  );

  return items.length > 0;
}

// Takes a list item out one level, or turns an item at the top level into a
// paragraph.
function outdent(editor: Editor, [item, path]: NodeEntry<ListItemElement>) {
  if (item.depth > 0) {
    Transforms.setNodes(editor, { depth: item.depth - 1 }, { at: path });
  } else {
    Transforms.setNodes(editor, { type: "paragraph" }, { at: path });
    Transforms.unsetNodes(editor, ["list", "depth"], { at: path });
  }
}

/**
 * Returns the first link in `at`, or in the selection, with its path, or
 * undefined when there is none.
 */
function activeLink(
  editor: Editor,
  at: Range | null = editor.selection,
): NodeEntry<LinkElement> | undefined {
  const [entry] = at ? Editor.nodes(editor, { at, match: isLink }) : [];

  return entry as NodeEntry<LinkElement> | undefined;
}

/**
 * Moves a selection inside a link to just after the link, so the text typed
 * next is not part of it. An empty run of text is added after the link when
 * nothing follows it yet.
 */
function leaveLink(editor: Editor): void {
  const link = editor.selection && activeLink(editor);
  if (!link) return;

  const next = Path.next(link[1]);

  if (Node.has(editor, next)) {
    Transforms.select(editor, Editor.start(editor, next));
  } else {
    Transforms.insertNodes(editor, { text: "" }, { at: next, select: true });
  }
}

/**
 * Links the text in `at` to `url`:
 *
 * - When `at` is in a link, that link goes to `url` instead.
 * - When `at` selects text, the text becomes the link's label.
 * - Otherwise the link is inserted at `at`, labelled `label`, or with `url`
 *   when `label` is blank.
 *
 * The selection ends after the link.
 */
function applyLink(editor: Editor, at: Range, url: string, label = ""): void {
  const link = activeLink(editor, at);

  if (link) {
    Transforms.setNodes(editor, { url }, { at: link[1] });
    Transforms.select(editor, Editor.end(editor, link[1]));
  } else if (Range.isExpanded(at)) {
    const range = Editor.rangeRef(editor, at, { affinity: "inward" });

    Transforms.wrapNodes(
      editor,
      { type: "link", url, children: [] },
      { at, split: true },
    );
    Transforms.select(editor, Range.end(range.unref()!));
  } else {
    const text = label.trim() || linkLabel(url);

    Transforms.insertNodes(
      editor,
      { type: "link", url, children: [{ text }] },
      { at, select: true },
    );
  }

  leaveLink(editor);
}

/** Turns the links in `at`, or in the selection, back into plain text. */
function removeLink(editor: Editor, at: Range | null = editor.selection): void {
  if (at) Transforms.unwrapNodes(editor, { at, match: isLink });
}

/**
 * Links the word that ends at a collapsed selection when it is a bare URL or
 * an email address (see `bareUrl`). The selection stays where it was, outside
 * the new link.
 */
function linkWordBefore(editor: Editor): void {
  const { selection } = editor;
  if (!selection || Range.isExpanded(selection) || activeLink(editor)) return;

  const point = selection.anchor;
  const node = Node.get(editor, point.path);
  if (!Text.isText(node)) return;

  const word = /\S+$/.exec(node.text.slice(0, point.offset))?.[0] ?? "";
  const link = bareUrl(word);
  if (link === null) return;

  const start = point.offset - word.length;
  const after = Editor.pointRef(editor, point, { affinity: "forward" });

  Transforms.wrapNodes(
    editor,
    { type: "link", url: link.url, children: [] },
    {
      at: {
        anchor: { path: point.path, offset: start },
        focus: { path: point.path, offset: start + link.text.length },
      },
      split: true,
    },
  );
  Transforms.select(editor, after.unref()!);
  leaveLink(editor);
}

/**
 * Replaces the editor's value with `value`, and clears its selection and its
 * undo history.
 */
function replaceValue(editor: Editor, value: RichTextValue): void {
  editor.children = value;
  editor.selection = null;
  editor.history = { undos: [], redos: [] };
  editor.onChange();
}

/**
 * Gives `editor` the behaviour of a rich-text editor and returns it:
 *
 * - A link is an inline element, and a link with no text is removed.
 * - A soft break, Shift+Enter, is a line break in the block.
 * - Enter in an empty list item, or Backspace at the start of any list item,
 *   takes the item out one level, and turns an item at the top level into a
 *   paragraph.
 * - Typing a space or a line break after a bare URL or an email address links
 *   it, and pasting one links it, or links the selected text to it.
 * - A list item's depth is kept between 0 and `MAX_DEPTH`.
 */
function withRichText<T extends Editor>(editor: T): T {
  const {
    deleteBackward,
    insertBreak,
    insertData,
    insertText,
    isInline,
    normalizeNode,
  } = editor;

  const emptyItem = (): NodeEntry<ListItemElement> | undefined => {
    const entry = editor.selection
      ? Editor.above(editor, { match: isListItem })
      : undefined;

    return entry && Node.string(entry[0]) === "" ? entry : undefined;
  };

  editor.isInline = (element) => isLink(element) || isInline(element);

  editor.insertSoftBreak = () => editor.insertText("\n");

  editor.insertText = (text) => {
    if (/^\s+$/.test(text)) linkWordBefore(editor);
    insertText(text);
  };

  editor.insertBreak = () => {
    const item = emptyItem();

    if (item) {
      outdent(editor, item);
    } else {
      linkWordBefore(editor);
      insertBreak();
    }
  };

  editor.deleteBackward = (unit) => {
    const { selection } = editor;
    const item =
      selection && Range.isCollapsed(selection)
        ? Editor.above(editor, { match: isListItem })
        : undefined;

    if (
      item &&
      Point.equals(selection!.anchor, Editor.start(editor, item[1]))
    ) {
      outdent(editor, item);
    } else {
      deleteBackward(unit);
    }
  };

  editor.insertData = (data) => {
    const pasted = data.getData("text/plain").trim();
    const link = /\s/.test(pasted) ? null : bareUrl(pasted);
    const { selection } = editor;

    if (link && link.text === pasted && selection && !activeLink(editor)) {
      applyLink(editor, selection, link.url, pasted);
    } else {
      insertData(data);
    }
  };

  editor.normalizeNode = (entry, options) => {
    const [node, path] = entry;

    if (isLink(node) && Node.string(node) === "") {
      Transforms.removeNodes(editor, { at: path });
    } else if (
      isListItem(node) &&
      (!Number.isInteger(node.depth) ||
        node.depth < 0 ||
        node.depth > MAX_DEPTH)
    ) {
      const depth = Math.max(
        0,
        Math.min(Math.trunc(node.depth) || 0, MAX_DEPTH),
      );
      Transforms.setNodes(editor, { depth }, { at: path });
    } else {
      normalizeNode(entry, options);
    }
  };

  return editor;
}

export {
  activeLink,
  activeList,
  applyLink,
  indent,
  isMarkActive,
  removeLink,
  replaceValue,
  toggleList,
  toggleMark,
  withRichText,
};

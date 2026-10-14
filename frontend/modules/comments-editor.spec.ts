import { createEditor, Editor, Transforms } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";
import { describe, expect, it } from "vitest";
import { parse, serialize, type CommentsValue } from "./comments";
import {
  activeLink,
  activeList,
  applyLink,
  indent,
  isMarkActive,
  removeLink,
  replaceValue,
  toggleList,
  toggleMark,
  withComments,
} from "./comments-editor";

// Returns a comments editor holding `markdown`, normalized as the editor
// would hold it.
const editorOf = (markdown: string) => {
  const editor = withComments(withHistory(withReact(createEditor())));
  editor.children = parse(markdown);
  Editor.normalize(editor, { force: true });

  return editor;
};

// Selects `text` in the first block that holds it.
const selectText = (editor: Editor, text: string) => {
  const [entry] = Editor.nodes(editor, {
    at: [],
    match: (node) => "text" in node && node.text.includes(text),
  });
  const [, path] = entry;
  const offset = (Editor.string(editor, path) as string).indexOf(text);

  Transforms.select(editor, {
    anchor: { path, offset },
    focus: { path, offset: offset + text.length },
  });
};

// Puts a collapsed selection at the end of the editor's value.
const atEnd = (editor: Editor) =>
  Transforms.select(editor, Editor.end(editor, []));

// Types `text` one character at a time, as a person types it.
const type = (editor: Editor, text: string) =>
  [...text].forEach((character) => editor.insertText(character));

const markdownOf = (editor: Editor) =>
  serialize(editor.children as CommentsValue);

describe("marks", () => {
  it("toggles bold and italic on the selected text", () => {
    const editor = editorOf("A long title");

    selectText(editor, "long");
    toggleMark(editor, "bold");
    expect(isMarkActive(editor, "bold")).toBe(true);
    toggleMark(editor, "italic");
    expect(markdownOf(editor)).toBe("A **_long_** title");

    toggleMark(editor, "bold");
    expect(isMarkActive(editor, "bold")).toBe(false);
    expect(markdownOf(editor)).toBe("A *long* title");
  });
});

describe("lists", () => {
  it("turns paragraphs into list items and back", () => {
    const editor = editorOf("one\n\ntwo");

    Transforms.select(editor, {
      anchor: Editor.start(editor, []),
      focus: Editor.end(editor, []),
    });
    toggleList(editor, "bulleted");
    expect(activeList(editor)).toBe("bulleted");
    expect(markdownOf(editor)).toBe("- one\n- two");

    toggleList(editor, "numbered");
    expect(markdownOf(editor)).toBe("1. one\n2. two");

    toggleList(editor, "numbered");
    expect(activeList(editor)).toBeNull();
    expect(markdownOf(editor)).toBe("one\n\ntwo");
  });

  it("indents an item at most one level below the item before it", () => {
    const editor = editorOf("- a\n- b\n- c");

    selectText(editor, "a");
    expect(indent(editor, 1)).toBe(true);
    expect(markdownOf(editor)).toBe("- a\n- b\n- c");

    selectText(editor, "c");
    indent(editor, 1);
    indent(editor, 1);
    expect(markdownOf(editor)).toBe("- a\n- b\n  - c");

    indent(editor, -1);
    expect(markdownOf(editor)).toBe("- a\n- b\n- c");
  });

  it("does not indent a paragraph", () => {
    const editor = editorOf("text");

    selectText(editor, "text");
    expect(indent(editor, 1)).toBe(false);
  });

  it("leaves the list with Enter in an empty item", () => {
    const editor = editorOf("- a\n  - b");

    atEnd(editor);
    editor.insertBreak();
    editor.insertBreak();
    type(editor, "c");
    expect(markdownOf(editor)).toBe("- a\n  - b\n- c");

    editor.insertBreak();
    editor.insertBreak();
    type(editor, "after");
    expect(markdownOf(editor)).toBe("- a\n  - b\n- c\n\nafter");
  });

  it("takes an item out a level with Backspace at its start", () => {
    const editor = editorOf("- a\n  - b");

    Transforms.select(editor, Editor.start(editor, [1]));
    editor.deleteBackward("character");
    expect(markdownOf(editor)).toBe("- a\n- b");

    editor.deleteBackward("character");
    expect(markdownOf(editor)).toBe("- a\n\nb");
  });
});

describe("line breaks", () => {
  it("breaks the line with a soft break", () => {
    const editor = editorOf("first");

    atEnd(editor);
    editor.insertSoftBreak();
    type(editor, "second");
    expect(markdownOf(editor)).toBe("first\\\nsecond");
  });
});

describe("links", () => {
  it("links the selected text", () => {
    const editor = editorOf("See the record here.");

    selectText(editor, "the record");
    applyLink(editor, editor.selection!, "https://example.com/r");
    expect(markdownOf(editor)).toBe(
      "See [the record](https://example.com/r) here.",
    );

    // The text typed next follows the link rather than joining it.
    type(editor, "!");
    expect(markdownOf(editor)).toBe(
      "See [the record](https://example.com/r)! here.",
    );
  });

  it("inserts a link with its label, or its address, at a collapsed selection", () => {
    const editor = editorOf("");

    atEnd(editor);
    type(editor, "Write to ");
    applyLink(editor, editor.selection!, "mailto:a@b.org");
    type(editor, " or read ");
    applyLink(editor, editor.selection!, "https://example.com", "the site");
    expect(markdownOf(editor)).toBe(
      "Write to <a@b.org> or read [the site](https://example.com)",
    );
  });

  it("changes the address of a link the selection is in", () => {
    const editor = editorOf("[label](https://old.example.com)");

    selectText(editor, "abe");
    expect(activeLink(editor)?.[0].url).toBe("https://old.example.com");
    applyLink(editor, editor.selection!, "https://new.example.com");
    expect(markdownOf(editor)).toBe("[label](https://new.example.com)");
  });

  it("removes a link and keeps its text", () => {
    const editor = editorOf("A [link](https://example.com) here");

    selectText(editor, "in");
    removeLink(editor);
    expect(markdownOf(editor)).toBe("A link here");
  });

  it("links a URL typed before a space or a line break", () => {
    const editor = editorOf("");

    atEnd(editor);
    type(editor, "See https://example.com/a. Then ");
    expect(markdownOf(editor)).toBe("See <https://example.com/a>. Then");

    type(editor, "www.example.org");
    editor.insertBreak();
    type(editor, "next");
    expect(markdownOf(editor)).toBe(
      "See <https://example.com/a>. Then [www.example.org](https://www.example.org)\n\nnext",
    );
    expect(activeLink(editor)).toBeUndefined();
  });

  it("links a pasted URL, or the selected text to it", () => {
    const editor = editorOf("Read this");
    const paste = (text: string) => {
      const data = {
        getData: (format: string) => (format === "text/plain" ? text : ""),
      } as DataTransfer;

      editor.insertData(data);
    };

    selectText(editor, "this");
    paste("https://example.com/this");
    atEnd(editor);
    type(editor, " and ");
    paste("a@b.org");
    expect(markdownOf(editor)).toBe(
      "Read [this](https://example.com/this) and <a@b.org>",
    );
  });

  it("removes a link whose text is deleted", () => {
    const editor = editorOf("A [x](https://example.com) b");

    selectText(editor, "x");
    editor.deleteFragment();
    expect(
      activeLink(editor, {
        anchor: Editor.start(editor, []),
        focus: Editor.end(editor, []),
      }),
    ).toBeUndefined();
    expect(markdownOf(editor)).toBe("A  b");
  });
});

describe("replaceValue", () => {
  it("replaces the value and forgets the selection and the history", () => {
    const editor = editorOf("old");

    atEnd(editor);
    type(editor, "er");
    replaceValue(editor, parse("**new**"));

    expect(editor.selection).toBeNull();
    expect(editor.history.undos).toEqual([]);
    expect(markdownOf(editor)).toBe("**new**");
  });
});

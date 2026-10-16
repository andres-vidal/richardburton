import { createEditor, Editor, Transforms } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";
import { item, link, paragraph } from "test/rich-text-fixtures";
import { describe, expect, it } from "vitest";
import { emptyValue, type RichTextValue } from "./rich-text";
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
  withRichText,
} from "./rich-text-editor";

// Returns an editor with `withRichText` holding `value`, normalized as the
// editor would hold it.
const editorOf = (value: RichTextValue = emptyValue()) => {
  const editor = withRichText(withHistory(withReact(createEditor())));
  editor.children = value;
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

// Pastes `text` as plain text.
const paste = (editor: Editor, text: string) =>
  editor.insertData({
    getData: (format: string) => (format === "text/plain" ? text : ""),
  } as DataTransfer);

describe("marks", () => {
  it("toggles bold and italic on the selected text", () => {
    const editor = editorOf([paragraph("A long title")]);

    selectText(editor, "long");
    toggleMark(editor, "bold");
    expect(isMarkActive(editor, "bold")).toBe(true);
    toggleMark(editor, "italic");
    expect(editor.children).toEqual([
      paragraph("A ", { text: "long", bold: true, italic: true }, " title"),
    ]);

    toggleMark(editor, "bold");
    expect(isMarkActive(editor, "bold")).toBe(false);
    expect(editor.children).toEqual([
      paragraph("A ", { text: "long", italic: true }, " title"),
    ]);
  });
});

describe("lists", () => {
  it("turns paragraphs into list items and back", () => {
    const editor = editorOf([paragraph("one"), paragraph("two")]);

    Transforms.select(editor, {
      anchor: Editor.start(editor, []),
      focus: Editor.end(editor, []),
    });
    toggleList(editor, "bulleted");
    expect(activeList(editor)).toBe("bulleted");
    expect(editor.children).toEqual([
      item("bulleted", 0, "one"),
      item("bulleted", 0, "two"),
    ]);

    toggleList(editor, "numbered");
    expect(editor.children).toEqual([
      item("numbered", 0, "one"),
      item("numbered", 0, "two"),
    ]);

    toggleList(editor, "numbered");
    expect(activeList(editor)).toBeNull();
    expect(editor.children).toEqual([paragraph("one"), paragraph("two")]);
  });

  it("indents an item at most one level below the item before it", () => {
    const editor = editorOf([
      item("bulleted", 0, "a"),
      item("bulleted", 0, "b"),
      item("bulleted", 0, "c"),
    ]);
    const depths = () =>
      (editor.children as RichTextValue).map((block) =>
        block.type === "list-item" ? block.depth : null,
      );

    selectText(editor, "a");
    expect(indent(editor, 1)).toBe(true);
    expect(depths()).toEqual([0, 0, 0]);

    selectText(editor, "c");
    indent(editor, 1);
    indent(editor, 1);
    expect(depths()).toEqual([0, 0, 1]);

    indent(editor, -1);
    expect(depths()).toEqual([0, 0, 0]);
  });

  it("does not indent a paragraph", () => {
    const editor = editorOf([paragraph("text")]);

    selectText(editor, "text");
    expect(indent(editor, 1)).toBe(false);
  });

  it("leaves the list with Enter in an empty item", () => {
    const editor = editorOf([
      item("bulleted", 0, "a"),
      item("bulleted", 1, "b"),
    ]);

    atEnd(editor);
    editor.insertBreak();
    editor.insertBreak();
    type(editor, "c");
    expect(editor.children).toEqual([
      item("bulleted", 0, "a"),
      item("bulleted", 1, "b"),
      item("bulleted", 0, "c"),
    ]);

    editor.insertBreak();
    editor.insertBreak();
    type(editor, "after");
    expect(editor.children).toEqual([
      item("bulleted", 0, "a"),
      item("bulleted", 1, "b"),
      item("bulleted", 0, "c"),
      paragraph("after"),
    ]);
  });

  it("takes an item out a level with Backspace at its start", () => {
    const editor = editorOf([
      item("bulleted", 0, "a"),
      item("bulleted", 1, "b"),
    ]);

    Transforms.select(editor, Editor.start(editor, [1]));
    editor.deleteBackward("character");
    expect(editor.children).toEqual([
      item("bulleted", 0, "a"),
      item("bulleted", 0, "b"),
    ]);

    editor.deleteBackward("character");
    expect(editor.children).toEqual([item("bulleted", 0, "a"), paragraph("b")]);
  });

  it("keeps an item's depth between 0 and the deepest level", () => {
    const editor = editorOf([
      item("numbered", -1, "a"),
      item("numbered", 7, "b"),
      item("numbered", 1.5, "c"),
    ]);

    expect(editor.children).toEqual([
      item("numbered", 0, "a"),
      item("numbered", 2, "b"),
      item("numbered", 1, "c"),
    ]);
  });
});

describe("line breaks", () => {
  it("breaks the line with a soft break", () => {
    const editor = editorOf([paragraph("first")]);

    atEnd(editor);
    editor.insertSoftBreak();
    type(editor, "second");
    expect(editor.children).toEqual([paragraph("first\nsecond")]);
  });
});

describe("links", () => {
  it("links the selected text", () => {
    const editor = editorOf([paragraph("See the record here.")]);

    selectText(editor, "the record");
    applyLink(editor, editor.selection!, "https://example.com/r");
    expect(editor.children).toEqual([
      paragraph("See ", link("https://example.com/r", "the record"), " here."),
    ]);

    // The text typed next follows the link rather than joining it.
    type(editor, "!");
    expect(editor.children).toEqual([
      paragraph("See ", link("https://example.com/r", "the record"), "! here."),
    ]);
  });

  it("inserts a link with its label, or its address, at a collapsed selection", () => {
    const editor = editorOf();

    atEnd(editor);
    type(editor, "Write to ");
    applyLink(editor, editor.selection!, "mailto:a@b.org");
    type(editor, " or read ");
    applyLink(editor, editor.selection!, "https://example.com", "the site");
    expect(editor.children).toEqual([
      paragraph(
        "Write to ",
        link("mailto:a@b.org", "a@b.org"),
        " or read ",
        link("https://example.com", "the site"),
        "",
      ),
    ]);
  });

  it("changes the address of a link the selection is in", () => {
    const editor = editorOf([
      paragraph("", link("https://old.example.com", "label"), ""),
    ]);

    selectText(editor, "abe");
    expect(activeLink(editor)?.[0].url).toBe("https://old.example.com");
    applyLink(editor, editor.selection!, "https://new.example.com");
    expect(editor.children).toEqual([
      paragraph("", link("https://new.example.com", "label"), ""),
    ]);
  });

  it("removes a link and keeps its text", () => {
    const editor = editorOf([
      paragraph("A ", link("https://example.com", "link"), " here"),
    ]);

    selectText(editor, "in");
    removeLink(editor);
    expect(editor.children).toEqual([paragraph("A link here")]);
  });

  it("links a URL typed before a space or a line break", () => {
    const editor = editorOf();

    atEnd(editor);
    type(editor, "See https://example.com/a. Then ");
    expect(editor.children).toEqual([
      paragraph(
        "See ",
        link("https://example.com/a", "https://example.com/a"),
        ". Then ",
      ),
    ]);

    type(editor, "www.example.org");
    editor.insertBreak();
    type(editor, "next");
    expect(editor.children).toEqual([
      paragraph(
        "See ",
        link("https://example.com/a", "https://example.com/a"),
        ". Then ",
        link("https://www.example.org", "www.example.org"),
        "",
      ),
      paragraph("next"),
    ]);
    expect(activeLink(editor)).toBeUndefined();
  });

  it("links a pasted URL, or the selected text to it", () => {
    const editor = editorOf([paragraph("Read this")]);

    selectText(editor, "this");
    paste(editor, "https://example.com/this");
    atEnd(editor);
    type(editor, " and ");
    paste(editor, "a@b.org");
    expect(editor.children).toEqual([
      paragraph(
        "Read ",
        link("https://example.com/this", "this"),
        " and ",
        link("mailto:a@b.org", "a@b.org"),
        "",
      ),
    ]);
  });

  it("removes a link whose text is deleted", () => {
    const editor = editorOf([
      paragraph("A ", link("https://example.com", "x"), " b"),
    ]);

    selectText(editor, "x");
    editor.deleteFragment();
    expect(
      activeLink(editor, {
        anchor: Editor.start(editor, []),
        focus: Editor.end(editor, []),
      }),
    ).toBeUndefined();
    expect(editor.children).toEqual([paragraph("A  b")]);
  });
});

describe("pasting text", () => {
  it("inserts each line after the first as a new block, with its bare URLs linked", () => {
    const editor = editorOf([item("bulleted", 0, "Seen: ")]);

    atEnd(editor);
    paste(
      editor,
      "the scan at https://archive.org/details/x,\r\nand a@b.org.\nDone",
    );
    expect(editor.children).toEqual([
      item(
        "bulleted",
        0,
        "Seen: the scan at ",
        link("https://archive.org/details/x", "https://archive.org/details/x"),
        ",",
      ),
      item("bulleted", 0, "and ", link("mailto:a@b.org", "a@b.org"), "."),
      item("bulleted", 0, "Done"),
    ]);
  });

  it("replaces the selected text", () => {
    const editor = editorOf([paragraph("Keep this part")]);

    selectText(editor, "this");
    paste(editor, "that, see www.example.com");
    expect(editor.children).toEqual([
      paragraph(
        "Keep that, see ",
        link("https://www.example.com", "www.example.com"),
        " part",
      ),
    ]);
  });

  it("adds pasted text inside a link to the link's text, without linking it", () => {
    const editor = editorOf([
      paragraph("", link("https://example.com", "the site"), ""),
    ]);

    selectText(editor, "site");
    Transforms.collapse(editor, { edge: "end" });
    paste(editor, " at www.example.com");
    expect(editor.children).toEqual([
      paragraph(
        "",
        link("https://example.com", "the site at www.example.com"),
        "",
      ),
    ]);
  });
});

describe("replaceValue", () => {
  it("replaces the value and forgets the selection and the history", () => {
    const editor = editorOf([paragraph("old")]);
    const next = [paragraph({ text: "new", bold: true })];

    atEnd(editor);
    type(editor, "er");
    replaceValue(editor, next);

    expect(editor.selection).toBeNull();
    expect(editor.history.undos).toEqual([]);
    expect(editor.children).toEqual(next);
  });
});

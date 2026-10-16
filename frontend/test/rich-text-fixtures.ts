import type {
  LinkElement,
  ListItemElement,
  ListKind,
  ParagraphElement,
  RichTextInline,
  RichTextRun,
  RichTextValue,
} from "modules/rich-text";

/**
 * Builders and samples of rich-text values (see `modules/rich-text`) for the
 * specs and stories. A builder takes each inline either as an object or as a
 * string, which stands for a run of plain text.
 */

/** Returns `inline`, or a run of plain text holding it when it is a string. */
const inlineOf = <T extends RichTextInline>(
  inline: T | string,
): T | RichTextRun => (typeof inline === "string" ? { text: inline } : inline);

/** Returns a paragraph holding `inlines`. */
function paragraph(...inlines: (RichTextInline | string)[]): ParagraphElement {
  return { type: "paragraph", children: inlines.map(inlineOf) };
}

/** Returns an item of a list of `list` kind, `depth` levels deep. */
function item(
  list: ListKind,
  depth: number,
  ...inlines: (RichTextInline | string)[]
): ListItemElement {
  return { type: "list-item", list, depth, children: inlines.map(inlineOf) };
}

/** Returns a link to `url` that shows `runs`. */
function link(url: string, ...runs: (RichTextRun | string)[]): LinkElement {
  return { type: "link", url, children: runs.map(inlineOf) };
}

/**
 * Rich text in every format it supports: a paragraph with bold and italic
 * text, a line break and a link, then a bulleted list with a numbered list
 * nested in its first item.
 */
const EVERY_FORMAT: RichTextValue = [
  paragraph(
    "A ",
    { text: "bold", bold: true },
    " claim and an ",
    { text: "italic", italic: true },
    " aside.\nA second line, with ",
    link("https://example.com/guide", "the guide"),
    ".",
  ),
  item("bulleted", 0, "Fruit"),
  item("numbered", 1, { text: "Apples", italic: true }),
  item("numbered", 1, { text: "Pears", italic: true }),
  item("bulleted", 0, "Bread"),
];

/**
 * Returns `value` typed as rich text, so that a test can pass a value that is
 * not rich text, such as a string, to a function that takes rich text.
 */
function unchecked(value: unknown): RichTextValue {
  return value as RichTextValue;
}

export { EVERY_FORMAT, item, link, paragraph, unchecked };

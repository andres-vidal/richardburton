import type { BaseEditor } from "slate";
import type { HistoryEditor } from "slate-history";
import type { ReactEditor } from "slate-react";

/**
 * The shape of rich text, and functions that read it and the links in it.
 *
 * **Rich text** holds paragraphs and line breaks, bold and italic text,
 * bulleted and numbered lists, and links. The API stores and returns it as its
 * value, and a Slate editor edits that same value.
 *
 * The **value** is a list of **blocks**, in reading order. A block is a
 * paragraph or a list item. A list item has a **kind**, bulleted or numbered,
 * in `list`, and a **depth**, from 0 for an item of a top-level list to
 * `MAX_DEPTH`. The items are not nested in the value: a nested list is a run of
 * items one level deeper than the item before them, so an item is edited like
 * any other line. A block holds **inlines**: runs of text, each bold, italic,
 * both or neither, and links, each with a URL and runs of text of its own. A
 * `"\n"` in a run of text is a line break.
 *
 * A value is **blank** when its text, the text of its links included, is
 * nothing but white space. A **bare URL** is a word of the text, outside any
 * link, that is a web address or an email address (see `bareUrl`).
 *
 * The functions that read a value, such as `plainText`, take a value of rich
 * text, or null or undefined for none. They do not throw on a value that is
 * not rich text, such as a string or a node of a type this module does not
 * define, and read such a value as `readValue` returns it.
 */

/** A formatting mark a run of text can carry. */
type RichTextMark = "bold" | "italic";

/** A run of text, with the marks it carries. */
type RichTextRun = { text: string; bold?: boolean; italic?: boolean };

/** A link: the URL it goes to, and the runs of text it shows. */
type LinkElement = { type: "link"; url: string; children: RichTextRun[] };

/** What a block holds: runs of text and links. */
type RichTextInline = RichTextRun | LinkElement;

/** The kind of list an item belongs to. */
type ListKind = "bulleted" | "numbered";

/** A paragraph. */
type ParagraphElement = { type: "paragraph"; children: RichTextInline[] };

/** An item of a list of `list` kind, `depth` levels deep. */
type ListItemElement = {
  type: "list-item";
  list: ListKind;
  depth: number;
  children: RichTextInline[];
};

/** A block of the value: a paragraph or a list item. */
type RichTextBlock = ParagraphElement | ListItemElement;

/** Any element of the value. */
type RichTextElement = RichTextBlock | LinkElement;

/** The value of rich text: its blocks, in reading order. */
type RichTextValue = RichTextBlock[];

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: RichTextElement;
    Text: RichTextRun;
  }
}

/** The depth of the deepest list item: lists nest three levels at most. */
const MAX_DEPTH = 2;

/**
 * Returns a value of one empty paragraph, the value of a Slate editor that
 * holds no text, since an editor needs a block to type in.
 */
function emptyValue(): RichTextValue {
  return [{ type: "paragraph", children: [{ text: "" }] }];
}

/** Returns whether a node of the value is a link. */
function isLink(node: unknown): node is LinkElement {
  return (node as LinkElement | undefined)?.type === "link";
}

// Returns whether `node` is an object other than an array.
function isRecord(node: unknown): node is Record<string, unknown> {
  return typeof node === "object" && node !== null && !Array.isArray(node);
}

// Returns whether `node` is a paragraph or a list item with a list of
// children, whatever its children are.
function isBlockShaped(
  node: unknown,
): node is Record<string, unknown> & { children: unknown[] } {
  return (
    isRecord(node) &&
    (node.type === "paragraph" || node.type === "list-item") &&
    Array.isArray(node.children)
  );
}

// Returns the text `node` holds. A string is its own text, a list holds the
// text of its items in order, and an object holds its `text`, when that is a
// string, followed by the text of its `children`. Anything else holds no text.
function textIn(node: unknown): string {
  return typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(textIn).join("")
      : isRecord(node)
        ? (typeof node.text === "string" ? node.text : "") +
          textIn(node.children)
        : "";
}

// Returns whether `node` holds text other than white space, read as `textIn`
// reads it. It stops at the first character that is not white space.
function hasText(node: unknown): boolean {
  return typeof node === "string"
    ? /\S/.test(node)
    : Array.isArray(node)
      ? node.some(hasText)
      : isRecord(node) &&
        ((typeof node.text === "string" && hasText(node.text)) ||
          hasText(node.children));
}

// Returns `inlines`, or one empty run of text when there are none, since an
// element of a value holds at least one run.
function withARun<T extends RichTextInline>(inlines: T[]): (T | RichTextRun)[] {
  return inlines.length > 0 ? inlines : [{ text: "" }];
}

// Returns `node` when it is a run of text, an object whose `text` is a string
// and that has neither a `type` nor `children`, and otherwise a run of the
// text it holds.
function runIn(node: unknown): RichTextRun {
  return isRecord(node) &&
    typeof node.text === "string" &&
    !("type" in node) &&
    !("children" in node)
    ? (node as RichTextRun)
    : { text: textIn(node) };
}

// Returns `node` as an inline: a link, with each of its children read as a run
// of text, when it is a link with a URL and a list of children, and otherwise
// a run of text (see `runIn`).
function inlineIn(node: unknown): RichTextInline {
  return isRecord(node) &&
    node.type === "link" &&
    typeof node.url === "string" &&
    Array.isArray(node.children)
    ? {
        type: "link",
        url: node.url,
        children: withARun(node.children.map(runIn)),
      }
    : runIn(node);
}

// Returns the blocks `node` makes: the node itself when it is a paragraph or a
// list item, with each of its children read as an inline, and otherwise a
// paragraph of the text the node holds, or no block when it holds none.
function blocksIn(node: unknown): RichTextBlock[] {
  return isBlockShaped(node)
    ? [
        {
          ...node,
          children: withARun(node.children.map(inlineIn)),
        } as RichTextBlock,
      ]
    : paragraphOf(textIn(node));
}

// Returns a paragraph of `text` alone, or no block when `text` is empty.
function paragraphOf(text: string): RichTextBlock[] {
  return text === "" ? [] : [{ type: "paragraph", children: [{ text }] }];
}

/**
 * Returns `value` as a value of rich text, whatever `value` is. Paragraphs and
 * list items are kept, and so are the runs of text and the links in them. Any
 * other part of `value` is read as the text it holds, where the text of a node
 * is its `text` followed by the text of its `children`:
 *
 * - a string becomes a paragraph of that text, with its line breaks;
 * - any other block, or any other object, becomes a paragraph of its text;
 * - any other inline becomes a run of its text.
 *
 * A node that holds no text makes no block, and null makes an empty value.
 * When `value` is rich text, the result equals it.
 *
 * It does not check that `value` has the shape this module describes. It
 * gives the functions that read a value something they can read, so that they
 * do not throw on a value that is not rich text.
 */
function readValue(value: unknown): RichTextValue {
  return Array.isArray(value) ? value.flatMap(blocksIn) : blocksIn(value);
}

/**
 * Returns the text of `value` on one line: the text of every block, links
 * included, with each block and line break as a space. Returns an empty string
 * for null, and for a blank value.
 */
function plainText(value: RichTextValue | null | undefined): string {
  return readValue(value).map(textIn).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Returns whether `value` is null or blank. It reads the text only until it
 * finds a character that is not white space.
 */
function isBlank(value: RichTextValue | null | undefined): boolean {
  return !hasText(readValue(value));
}

/** Splits text into graphemes, the characters a reader sees. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Returns the number of graphemes in `text`.
function graphemeCount(text: string): number {
  return Array.from(GRAPHEMES.segment(text)).length;
}

/**
 * Returns the number of characters in the text of `value`: the text of its
 * runs, links included, in order, with nothing between blocks. A line break is
 * one character. A character is a grapheme, so a letter with an accent, or an
 * emoji made of several code points, counts as one. Returns 0 for null.
 */
function textLength(value: RichTextValue | null | undefined): number {
  return graphemeCount(textIn(value));
}

/**
 * Returns whether the text of `value` has more than `max` characters, counted
 * as `textLength` counts them. It splits the text into graphemes only when the
 * text has more than `max` UTF-16 code units, since a text has no more
 * characters than code units.
 */
function isLongerThan(
  value: RichTextValue | null | undefined,
  max: number,
): boolean {
  const text = textIn(value);

  return text.length > max && graphemeCount(text) > max;
}

/**
 * Returns `url` trimmed when it is an `http`, `https` or `mailto` URL, and
 * null otherwise.
 */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();

  return /^(https?:\/\/|mailto:)\S/i.test(trimmed) ? trimmed : null;
}

/** An email address, as a person types one. */
const EMAIL = /^[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[^\s@<>()[\]]+$/;

/**
 * Returns the URL a link to `typed` goes to, or null when `typed` is neither
 * a URL nor an address. An `http`, `https` or `mailto` URL is returned as it
 * is, an email address gets `mailto:` and a web address without a scheme,
 * such as `www.example.com/page`, gets `https://`.
 */
function linkTarget(typed: string): string | null {
  const text = typed.trim();

  return /\s/.test(text) || text === ""
    ? null
    : (safeUrl(text) ??
        (EMAIL.test(text)
          ? `mailto:${text}`
          : /^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(text)
            ? `https://${text}`
            : null));
}

/**
 * Returns the link a word of the text makes: the start of the word that is the
 * link's `text`, and the `url` it goes to. Returns null when the word is not a
 * link. A word starting with `http://`, `https://` or `www.`, or an email
 * address, is a link. Punctuation at the end of the word, such as the full stop
 * after a URL that ends a sentence, is not part of it.
 */
function bareUrl(word: string): { text: string; url: string } | null {
  const text = word.replace(/[.,;:!?)\]'"]+$/, "");
  const url =
    /^(https?:\/\/|www\.)[^\s.]/i.test(text) || EMAIL.test(text)
      ? linkTarget(text)
      : null;

  return url === null ? null : { text, url };
}

/** Returns the text a link to `url` shows when it has no label of its own. */
function linkLabel(url: string): string {
  return url.replace(/^mailto:/i, "");
}

/**
 * Returns `inlines` with each bare URL in their runs of text made a link that
 * shows the URL as it is written. The link's run carries the marks of the run
 * the URL was in, and so do the runs of text before and after it. Links are
 * returned as they are.
 */
function linkBareUrls(inlines: RichTextInline[]): RichTextInline[] {
  return inlines.flatMap((inline): RichTextInline[] => {
    if (isLink(inline)) return [inline];

    const { text, ...marks } = inline;

    return text
      .split(/(\s+)/)
      .reduce<RichTextInline[]>((result, word) => {
        const link = bareUrl(word);
        const last = result[result.length - 1];

        return link !== null
          ? [
              ...result,
              {
                type: "link",
                url: link.url,
                children: [{ ...marks, text: link.text }],
              },
              { ...marks, text: word.slice(link.text.length) },
            ]
          : last !== undefined && !isLink(last)
            ? [...result.slice(0, -1), { ...last, text: last.text + word }]
            : [...result, { ...marks, text: word }];
      }, [])
      .filter((piece) => isLink(piece) || piece.text !== "");
  });
}

export {
  MAX_DEPTH,
  bareUrl,
  emptyValue,
  isBlank,
  isLink,
  isLongerThan,
  linkBareUrls,
  linkLabel,
  linkTarget,
  plainText,
  readValue,
  safeUrl,
  textLength,
};
export type {
  LinkElement,
  ListItemElement,
  ListKind,
  ParagraphElement,
  RichTextBlock,
  RichTextInline,
  RichTextMark,
  RichTextRun,
  RichTextValue,
};

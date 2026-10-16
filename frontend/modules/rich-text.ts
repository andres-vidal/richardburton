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

// Returns the text of an inline: a run's own text, or the text of a link's
// runs.
function textOf(inline: RichTextInline): string {
  return isLink(inline) ? inline.children.map(textOf).join("") : inline.text;
}

/**
 * Returns the text of `value` on one line: the text of every block, links
 * included, with each block and line break as a space. Returns an empty string
 * for null, and for a blank value.
 */
function plainText(value: RichTextValue | null | undefined): string {
  return (value ?? [])
    .map((block) => block.children.map(textOf).join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns whether `value` is null or blank. */
function isBlank(value: RichTextValue | null | undefined): boolean {
  return plainText(value) === "";
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
  linkBareUrls,
  linkLabel,
  linkTarget,
  plainText,
  safeUrl,
};
export type {
  LinkElement,
  ListItemElement,
  ListKind,
  ParagraphElement,
  RichTextBlock,
  RichTextElement,
  RichTextInline,
  RichTextMark,
  RichTextRun,
  RichTextValue,
};

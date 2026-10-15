import type * as Mdast from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmAutolinkLiteralFromMarkdown } from "mdast-util-gfm-autolink-literal";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmAutolinkLiteral } from "micromark-extension-gfm-autolink-literal";
import type { BaseEditor } from "slate";
import type { HistoryEditor } from "slate-history";
import type { ReactEditor } from "slate-react";

/**
 * Converts a publication's notes between the Markdown they are stored as
 * and the value the notes editor edits.
 *
 * The **value** is a list of **blocks**, the shape Slate edits. A block is a
 * paragraph or a list item. A list item has a **kind**, bulleted or numbered,
 * in `list`, and a **depth**, from 0 for an item of a top-level list to
 * `MAX_DEPTH`. The items are not nested in the value: a nested list is a run of
 * items one level deeper than the item before them, so an item is edited like
 * any other line. A block holds **inlines**: runs of text, each bold, italic,
 * both or neither, and links, each with a URL and runs of text of its own. A
 * `"\n"` in a run of text is a line break.
 *
 * Notes support only that subset of Markdown. `parse` reads any Markdown
 * and keeps the text of what the subset lacks: a heading becomes a paragraph,
 * code and raw HTML become plain text, an image becomes its alternative text,
 * and a link to anything but an `http`, `https` or `mailto` URL becomes its
 * label. A bare URL or email address becomes a link, as GitHub reads one.
 *
 * `serialize` writes a value back as Markdown that parses back into the same
 * value, with two differences. Blank blocks are left out, since Markdown has
 * no empty paragraph, and the bare URLs left in the text are written as links,
 * so the stored Markdown always holds them as links.
 */

/** A formatting mark a run of text can carry. */
type NotesMark = "bold" | "italic";

/** A run of text, with the marks it carries. */
type NotesText = { text: string; bold?: boolean; italic?: boolean };

/** A link: the URL it goes to, and the runs of text it shows. */
type LinkElement = { type: "link"; url: string; children: NotesText[] };

/** What a block holds: runs of text and links. */
type NotesInline = NotesText | LinkElement;

/** The kind of list an item belongs to. */
type ListKind = "bulleted" | "numbered";

/** A paragraph. */
type ParagraphElement = { type: "paragraph"; children: NotesInline[] };

/** An item of a list of `list` kind, `depth` levels deep. */
type ListItemElement = {
  type: "list-item";
  list: ListKind;
  depth: number;
  children: NotesInline[];
};

/** A block of the value: a paragraph or a list item. */
type NotesBlock = ParagraphElement | ListItemElement;

/** Any element of the value. */
type NotesElement = NotesBlock | LinkElement;

/** The value of the notes editor: its blocks, in reading order. */
type NotesValue = NotesBlock[];

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: NotesElement;
    Text: NotesText;
  }
}

/** The depth of the deepest list item: lists nest three levels at most. */
const MAX_DEPTH = 2;

/** The syntax `parse` reads: CommonMark, with GFM's bare URLs as links. */
const SYNTAX = {
  extensions: [gfmAutolinkLiteral()],
  mdastExtensions: [gfmAutolinkLiteralFromMarkdown()],
};

/**
 * How `serialize` writes Markdown: `-` for bullets, `*` for emphasis and
 * `**` for strong emphasis, which also work inside a word, and list items
 * indented by one space after the marker.
 */
const STYLE = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  listItemIndent: "one",
} as const;

/**
 * Finds the bare URLs and email addresses in a tree's text, outside links,
 * and wraps each in a link. It is GFM's own rule, the one `parse` reads them
 * with.
 */
const linkBareUrls = gfmAutolinkLiteralFromMarkdown().transforms![0];

/** Returns an empty paragraph, the value of empty notes. */
function emptyParagraph(): ParagraphElement {
  return { type: "paragraph", children: [{ text: "" }] };
}

/** Returns whether a node of the value is a link. */
function isLink(node: unknown): node is LinkElement {
  return (node as LinkElement | undefined)?.type === "link";
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
 * Returns the link a word typed or pasted in the editor makes: the start of the
 * word that is the link's `text`, and the `url` it goes to. Returns null when
 * the word is not a link. A word starting with `http://`, `https://` or
 * `www.`, or an email address, is a link. Punctuation at the end of the word,
 * such as the full stop after a URL that ends a sentence, is not part of it.
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

// --- Markdown to value ------------------------------------------------------

/**
 * What a conversion from Markdown reads alongside each node: the URL of each
 * link reference definition, by its identifier.
 */
type Reading = { definitions: Map<string, string> };

/** The marks a run of text inherits from the emphasis around it. */
type Marks = { bold?: boolean; italic?: boolean };

/**
 * Returns the value that `markdown` holds. Empty or missing notes give one
 * empty paragraph, since the editor needs a block to type in.
 */
function parse(markdown: string | null | undefined): NotesValue {
  const root = fromMarkdown(markdown ?? "", SYNTAX);
  const reading = { definitions: definitionsOf(root) };
  const blocks = blocksOf(root.children, reading);

  return blocks.length > 0 ? blocks : [emptyParagraph()];
}

// Returns the URL of each link reference definition in the tree, by its
// identifier.
function definitionsOf(root: Mdast.Root): Map<string, string> {
  const definitions = new Map<string, string>();

  const visit = (node: Mdast.Nodes) => {
    if (node.type === "definition") definitions.set(node.identifier, node.url);
    if ("children" in node) node.children.forEach(visit);
  };
  visit(root);

  return definitions;
}

// Returns the blocks that Markdown blocks become. A list becomes its items,
// nested lists included, and a block quote becomes the blocks it quotes. A
// paragraph or a heading becomes a paragraph, and code or raw HTML becomes a
// paragraph of its text, one line per line. A thematic break or a definition
// holds no text and becomes nothing.
function blocksOf(
  nodes: Mdast.Nodes[],
  reading: Reading,
  depth = 0,
): NotesBlock[] {
  return nodes.flatMap((node): NotesBlock[] => {
    switch (node.type) {
      case "list":
        return itemsOf(node, reading, depth);
      case "paragraph":
      case "heading":
        return [paragraph(inlinesOf(node.children, reading))];
      case "code":
      case "html":
        return [paragraph([{ text: node.value }])];
      case "thematicBreak":
      case "definition":
        return [];
      default:
        return "children" in node
          ? blocksOf(node.children as Mdast.Nodes[], reading, depth)
          : "value" in node
            ? [paragraph([{ text: String(node.value) }])]
            : [];
    }
  });
}

// Returns the items of a list, each followed by the items of the lists nested
// in it, one level deeper. An item's other blocks are joined into its text,
// one line each. A list nested deeper than `MAX_DEPTH` keeps its items at
// `MAX_DEPTH`.
function itemsOf(
  list: Mdast.List,
  reading: Reading,
  depth: number,
): NotesBlock[] {
  const kind: ListKind = list.ordered ? "numbered" : "bulleted";

  return list.children.flatMap((item) => {
    const own = item.children.filter((child) => child.type !== "list");
    const nested = item.children.filter((child) => child.type === "list");
    const lines = blocksOf(own, reading, depth).map((block) => block.children);

    return [
      {
        type: "list-item",
        list: kind,
        depth: Math.min(depth, MAX_DEPTH),
        children: tidy(joinLines(lines)),
      },
      ...blocksOf(nested, reading, depth + 1),
    ];
  });
}

// Returns runs of inlines as one, with a line break between each two.
function joinLines(lines: NotesInline[][]): NotesInline[] {
  return lines.flatMap((line, index) =>
    index === 0 ? line : [{ text: "\n" }, ...line],
  );
}

// Returns a paragraph of `inlines`.
function paragraph(inlines: NotesInline[]): ParagraphElement {
  return { type: "paragraph", children: tidy(inlines) };
}

// Returns the inlines that Markdown phrasing becomes, with `marks` on every
// run of text. Strong emphasis adds bold and emphasis adds italic. A link to a
// safe URL is a link, and inside a link, or with any other URL, a link is its
// label. A link with no label shows its URL. Code, raw HTML and line breaks
// are text, and an image is its alternative text, or its URL when it has none.
function inlinesOf(
  nodes: Mdast.Nodes[],
  reading: Reading,
  marks: Marks = {},
  inLink = false,
): NotesInline[] {
  const text = (value: string): NotesText[] => [{ text: value, ...marks }];

  return nodes.flatMap((node): NotesInline[] => {
    switch (node.type) {
      case "text":
      case "inlineCode":
      case "html":
        return text(node.value);
      case "break":
        return text("\n");
      case "strong":
        return inlinesOf(node.children, reading, { ...marks, bold: true });
      case "emphasis":
        return inlinesOf(node.children, reading, { ...marks, italic: true });
      case "image":
        return text(node.alt || node.url);
      case "imageReference":
        return text(node.alt ?? "");
      case "link":
      case "linkReference": {
        const url =
          node.type === "link"
            ? node.url
            : (reading.definitions.get(node.identifier) ?? "");
        const label = inlinesOf(node.children, reading, marks, true);
        const safe = inLink ? null : safeUrl(url);
        const shown = label.some((inline) => !isLink(inline) && inline.text)
          ? (label as NotesText[])
          : text(linkLabel(url));

        return safe === null
          ? label
          : [{ type: "link", url: safe, children: shown }];
      }
      default:
        return "children" in node
          ? inlinesOf(node.children as Mdast.Nodes[], reading, marks, inLink)
          : "value" in node
            ? text(String(node.value))
            : [];
    }
  });
}

/** Returns whether two runs of text carry the same marks. */
function sameMarks(one: NotesText, other: NotesText): boolean {
  return (
    Boolean(one.bold) === Boolean(other.bold) &&
    Boolean(one.italic) === Boolean(other.italic)
  );
}

// Returns inlines the way Slate keeps them: adjacent runs with the same marks
// joined, empty runs dropped, and a run of text, empty if need be, at the
// start, at the end and between two links. Each link's own runs are tidied
// the same way, and a link always holds at least one run.
function tidy(inlines: NotesInline[]): NotesInline[] {
  const joined = inlines.reduce<NotesInline[]>((result, inline) => {
    const last = result[result.length - 1];
    const node = isLink(inline)
      ? { ...inline, children: tidyTexts(inline.children) }
      : inline;

    return isLink(node)
      ? [
          ...result,
          ...(last === undefined || isLink(last) ? [{ text: "" }] : []),
          node,
        ]
      : node.text === ""
        ? result
        : last !== undefined && !isLink(last) && sameMarks(last, node)
          ? [...result.slice(0, -1), { ...last, text: last.text + node.text }]
          : [...result, node];
  }, []);

  const last = joined[joined.length - 1];

  return last === undefined || isLink(last)
    ? [...joined, { text: "" }]
    : joined;
}

// Returns runs of text with adjacent runs of the same marks joined and empty
// runs dropped, or one empty run when none is left.
function tidyTexts(texts: NotesText[]): NotesText[] {
  const tidied = tidy(texts).filter(
    (inline): inline is NotesText => !isLink(inline) && inline.text !== "",
  );

  return tidied.length > 0 ? tidied : [{ text: "" }];
}

// --- Value to Markdown ------------------------------------------------------

/**
 * A piece of a block as `phrasing` lays it out: a run of text with its marks,
 * or a link with the pieces of its label.
 */
type Piece =
  | { kind: "text"; text: string; bold: boolean; italic: boolean }
  | { kind: "link"; url: string; pieces: Piece[] };

/**
 * Returns the Markdown tree that `value` stands for: its paragraphs, and each
 * run of list items as nested lists, with every bare URL in the text linked.
 *
 * Markdown has no empty paragraph or empty list item, so blank blocks are left
 * out. A list item deeper than the one before it by more than one level is
 * taken to be one level deeper, as the nesting of Markdown lists allows.
 */
function toTree(value: NotesValue): Mdast.Root {
  const children: Mdast.RootContent[] = [];

  value.forEach((block, index) => {
    if (block.type === "list-item") {
      // A run of items is laid out when its first item is reached.
      if (value[index - 1]?.type !== "list-item") {
        children.push(...listsOf(runFrom(value, index), 0));
      }
    } else if (!isBlank(block)) {
      children.push({ type: "paragraph", children: phrasing(block.children) });
    }
  });

  const root: Mdast.Root = { type: "root", children };
  linkBareUrls(root);

  return root;
}

// Returns the run of list items that starts at `start`, without blank items,
// with each item's depth at most one more than the item before it.
function runFrom(value: NotesValue, start: number): ListItemElement[] {
  const end = value.findIndex(
    (block, index) => index > start && block.type !== "list-item",
  );
  const run = value
    .slice(start, end === -1 ? undefined : end)
    .filter((block): block is ListItemElement => !isBlank(block));

  return run.reduce<ListItemElement[]>((items, item) => {
    const before = items[items.length - 1]?.depth ?? -1;
    const depth = Math.max(0, Math.min(item.depth, before + 1, MAX_DEPTH));

    return [...items, { ...item, depth }];
  }, []);
}

// Returns the lists that `items` form at `depth`: each item at `depth` with
// the deeper items after it as its nested lists. Consecutive items of the
// same kind share a list.
function listsOf(items: ListItemElement[], depth: number): Mdast.List[] {
  const starts = items.flatMap((item, index) =>
    item.depth === depth ? [index] : [],
  );

  return starts.reduce<Mdast.List[]>((lists, start, at) => {
    const item = items[start];
    const nested = items.slice(start + 1, starts[at + 1] ?? items.length);
    const ordered = item.list === "numbered";
    const entry: Mdast.ListItem = {
      type: "listItem",
      spread: false,
      children: [
        { type: "paragraph", children: phrasing(item.children) },
        ...listsOf(nested, depth + 1),
      ],
    };
    const last = lists[lists.length - 1];

    return last?.ordered === ordered
      ? [
          ...lists.slice(0, -1),
          { ...last, children: [...last.children, entry] },
        ]
      : [
          ...lists,
          {
            type: "list",
            ordered,
            spread: false,
            ...(ordered ? { start: 1 } : {}),
            children: [entry],
          },
        ];
  }, []);
}

// Returns whether a block holds nothing but white space.
function isBlank(block: NotesBlock): boolean {
  return block.children.every((inline) =>
    isLink(inline) ? false : inline.text.trim() === "",
  );
}

// Returns the Markdown phrasing of a block's inlines. White space at either
// end of the block is dropped, since Markdown drops it too.
function phrasing(inlines: NotesInline[]): Mdast.PhrasingContent[] {
  return marked(edges(inlines.map(pieceOf)).inner, ["bold", "italic"]);
}

// Returns the piece an inline is laid out as.
function pieceOf(inline: NotesInline): Piece {
  return isLink(inline)
    ? { kind: "link", url: inline.url, pieces: inline.children.map(pieceOf) }
    : {
        kind: "text",
        text: inline.text,
        bold: Boolean(inline.bold),
        italic: Boolean(inline.italic),
      };
}

// Splits the white space at the ends of a run of pieces from the pieces
// between: `lead` is the white space the run starts with, `trail` the white
// space it ends with, and `inner` the pieces left, without empty ones.
function edges(pieces: Piece[]): {
  lead: string;
  inner: Piece[];
  trail: string;
} {
  const first = pieces[0];
  const last = pieces[pieces.length - 1];

  if (first?.kind === "text" && /^\s/.test(first.text)) {
    const space = /^\s*/.exec(first.text)![0];
    const rest = first.text.slice(space.length);
    const next = edges(
      rest ? [{ ...first, text: rest }, ...pieces.slice(1)] : pieces.slice(1),
    );

    return { ...next, lead: space + next.lead };
  }

  if (last?.kind === "text" && /\s$/.test(last.text)) {
    const space = /\s*$/.exec(last.text)![0];
    const rest = last.text.slice(0, -space.length);
    const next = edges(
      rest
        ? [...pieces.slice(0, -1), { ...last, text: rest }]
        : pieces.slice(0, -1),
    );

    return { ...next, trail: next.trail + space };
  }

  return { lead: "", inner: pieces, trail: "" };
}

// Returns pieces as Markdown phrasing, wrapping each run of consecutive pieces
// that carry the first of `marks` in one node for it, and the pieces inside in
// the rest of `marks`. Bold wraps italic, so a bold run that turns italic is
// one strong node rather than two side by side. The white space at the ends of
// a run is left outside its node, because Markdown does not open or close
// emphasis next to white space.
function marked(pieces: Piece[], marks: NotesMark[]): Mdast.PhrasingContent[] {
  const [mark, ...rest] = marks;

  if (mark === undefined) return pieces.flatMap(unmarked);

  const has = (piece: Piece) => piece.kind === "text" && piece[mark];
  const groups = pieces.reduce<Piece[][]>((result, piece) => {
    const last = result[result.length - 1];

    return last !== undefined && has(last[0]) === has(piece)
      ? [...result.slice(0, -1), [...last, piece]]
      : [...result, [piece]];
  }, []);
  const space = (text: string) =>
    unmarked({ kind: "text", text, bold: false, italic: false });

  return groups.flatMap((group): Mdast.PhrasingContent[] => {
    if (!has(group[0])) return marked(group, rest);

    const { lead, inner, trail } = edges(group);
    const node: Mdast.PhrasingContent = {
      type: mark === "bold" ? "strong" : "emphasis",
      children: marked(inner, rest),
    };

    return [
      ...space(lead),
      ...(inner.length > 0 ? [node] : []),
      ...space(trail),
    ];
  });
}

// Returns a piece without marks as Markdown phrasing: a link with its label,
// or text with a break node for each line break. Spaces next to a line break
// are dropped, as Markdown drops them.
function unmarked(piece: Piece): Mdast.PhrasingContent[] {
  return piece.kind === "link"
    ? [
        {
          type: "link",
          url: piece.url,
          children: marked(piece.pieces, ["bold", "italic"]),
        },
      ]
    : piece.text
        .split(/[ \t]*\n[ \t]*/)
        .flatMap((line, index): Mdast.PhrasingContent[] => [
          ...(index > 0 ? [{ type: "break" as const }] : []),
          ...(line ? [{ type: "text" as const, value: line }] : []),
        ]);
}

/**
 * Returns `value` as Markdown, or an empty string when it holds no text.
 */
function serialize(value: NotesValue): string {
  return toMarkdown(toTree(value), STYLE).trim();
}

/**
 * Returns the text of notes in Markdown on one line: the text of every
 * block, links included, with each block and line break as a space.
 */
function plainText(markdown: string | null | undefined): string {
  const textOf = (inline: NotesInline): string =>
    isLink(inline) ? inline.children.map(textOf).join("") : inline.text;

  return parse(markdown)
    .map((block) => block.children.map(textOf).join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export {
  MAX_DEPTH,
  bareUrl,
  isLink,
  linkLabel,
  linkTarget,
  parse,
  plainText,
  safeUrl,
  serialize,
  toTree,
};
export type {
  NotesBlock,
  NotesElement,
  NotesInline,
  NotesMark,
  NotesText,
  NotesValue,
  LinkElement,
  ListItemElement,
  ListKind,
  ParagraphElement,
};

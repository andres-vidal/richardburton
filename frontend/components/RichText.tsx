import {
  isBlank,
  isLink,
  readValue,
  safeUrl,
  type ListItemElement,
  type RichTextBlock,
  type RichTextInline,
  type RichTextMark,
  type RichTextValue,
} from "modules/rich-text";
import { FC, Fragment, ReactNode } from "react";

/** The marks of a run of text, outermost first: bold wraps italic. */
const MARKS: RichTextMark[] = ["bold", "italic"];

// Returns the blocks of a value as React elements: a paragraph for each
// paragraph, and nested lists for each run of consecutive list items. Blank
// blocks render nothing.
function renderBlocks(blocks: RichTextValue): ReactNode[] {
  return blocks.flatMap((block, index): ReactNode[] =>
    block.type === "paragraph"
      ? isBlank([block])
        ? []
        : [<p key={index}>{renderInlines(block.children)}</p>]
      : blocks[index - 1]?.type === "list-item"
        ? []
        : renderLists(runFrom(blocks, index)).map((list, at) => (
            <Fragment key={`${index}-${at}`}>{list}</Fragment>
          )),
  );
}

// Returns the run of list items that starts at `start`, without blank items.
function runFrom(blocks: RichTextBlock[], start: number): ListItemElement[] {
  const end = blocks.findIndex(
    (block, index) => index > start && block.type !== "list-item",
  );

  return blocks
    .slice(start, end === -1 ? undefined : end)
    .filter(
      (block): block is ListItemElement =>
        block.type === "list-item" && !isBlank([block]),
    );
}

// Returns the lists that a run of list items forms, as React elements. The
// items of the outer lists are the first item and every item that is no deeper
// than any item before it. Each of them holds, as its nested lists, the items
// after it up to the next of them, so that an item is nested in the closest
// item before it that is shallower than it. Consecutive outer items of the same
// kind share a list: an `ol` for numbered items and a `ul` for bulleted ones.
function renderLists(items: ListItemElement[]): ReactNode[] {
  const starts = items.flatMap((item, index) =>
    items.slice(0, index).every((before) => item.depth <= before.depth)
      ? [index]
      : [],
  );
  const entries = starts.map((start, at) => ({
    item: items[start],
    nested: items.slice(start + 1, starts[at + 1] ?? items.length),
  }));
  const lists = entries.reduce<(typeof entries)[]>((result, entry) => {
    const last = result[result.length - 1];

    return last?.[0].item.list === entry.item.list
      ? [...result.slice(0, -1), [...last, entry]]
      : [...result, [entry]];
  }, []);

  return lists.map((list, index) => {
    const listItems = list.map(({ item, nested }, at) => (
      <li key={at} className="pl-0.5">
        {renderInlines(item.children)}
        {renderLists(nested)}
      </li>
    ));

    return list[0].item.list === "numbered" ? (
      <ol key={index} className="pl-5 space-y-0.5 list-decimal">
        {listItems}
      </ol>
    ) : (
      <ul key={index} className="pl-5 space-y-0.5 list-disc">
        {listItems}
      </ul>
    );
  });
}

// Returns whether an inline is a run of text that carries `mark`.
function carries(inline: RichTextInline, mark: RichTextMark): boolean {
  return !isLink(inline) && inline[mark] === true;
}

// Splits inlines into stretches of consecutive inlines that all carry `mark`
// or all do not, in order.
function stretchesOf(
  inlines: RichTextInline[],
  mark: RichTextMark,
): RichTextInline[][] {
  return inlines.reduce<RichTextInline[][]>((result, inline) => {
    const last = result[result.length - 1];

    return last !== undefined &&
      carries(last[0], mark) === carries(inline, mark)
      ? [...result.slice(0, -1), [...last, inline]]
      : [...result, [inline]];
  }, []);
}

// Returns inlines as React elements. Each stretch of consecutive runs of text
// that carry the first of `marks` is wrapped in one element for it, `strong`
// for bold and `em` for italic, and the inlines inside each stretch, and
// between stretches, are wrapped by the rest of `marks`.
function renderInlines(
  inlines: RichTextInline[],
  marks: RichTextMark[] = MARKS,
): ReactNode[] {
  const [mark, ...rest] = marks;

  return mark === undefined
    ? inlines.map(renderInline)
    : stretchesOf(inlines, mark).map((stretch, index) =>
        !carries(stretch[0], mark) ? (
          <Fragment key={index}>{renderInlines(stretch, rest)}</Fragment>
        ) : mark === "bold" ? (
          <strong key={index} className="font-semibold">
            {renderInlines(stretch, rest)}
          </strong>
        ) : (
          <em key={index}>{renderInlines(stretch, rest)}</em>
        ),
      );
}

// Returns an inline without marks as a React element: a link that opens in a
// new tab, or text with a `br` for each line break. A link to anything but an
// `http`, `https` or `mailto` URL renders its text alone.
function renderInline(inline: RichTextInline, key: number): ReactNode {
  const url = isLink(inline) ? safeUrl(inline.url) : null;

  return isLink(inline) ? (
    url === null ? (
      <Fragment key={key}>{renderInlines(inline.children)}</Fragment>
    ) : (
      <a
        key={key}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="anchor"
      >
        {renderInlines(inline.children)}
      </a>
    )
  ) : (
    <Fragment key={key}>
      {inline.text.split("\n").map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </Fragment>
  );
}

/**
 * Renders rich text from its value (see `modules/rich-text`): paragraphs,
 * bulleted and numbered lists, line breaks, bold and italic text, and links.
 * A link opens in a new tab and passes on neither the page nor its address.
 * Renders nothing when the value is null or blank.
 *
 * A run of list items renders as nested lists. Each item is nested in the
 * closest item before it that is shallower than it, and an item with no
 * shallower item before it is in an outer list. A nested list is one level
 * deeper than the item that holds it, whatever the depths of its items, since
 * a list cannot skip a level. Blank blocks render nothing.
 *
 * Only the links of the value render as links: a URL written in a run of text
 * is text. A link to anything but an `http`, `https` or `mailto` URL renders
 * as its text. The text is set as text, so characters such as `<` or `*` in
 * it are shown as they are.
 *
 * `value` is rich text, or null or undefined for none. A stored value that is
 * not rich text, such as a string or a node of a type rich text does not
 * define, renders as the text it holds (see `readValue`).
 *
 * `size` sets the size of the text: `base`, the default, is small body text,
 * and `small` is a size smaller, with less space between blocks.
 */
const RichText: FC<{
  value: RichTextValue | null | undefined;
  size?: "base" | "small";
}> = ({ value, size = "base" }) => {
  const blocks = readValue(value);

  return isBlank(blocks) ? null : (
    <div
      data-size={size}
      className="space-y-2 text-gray-700 break-words data-[size=base]:text-sm data-[size=small]:text-xs data-[size=small]:space-y-1"
    >
      {renderBlocks(blocks)}
    </div>
  );
};

export default RichText;

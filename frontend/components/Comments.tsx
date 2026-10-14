import type * as Mdast from "mdast";
import { parse, toTree } from "modules/comments";
import { FC, Fragment, ReactNode } from "react";

/**
 * Renders the Markdown nodes that `toTree` builds as React elements: a
 * paragraph, a bulleted or numbered list with its items, bold and italic text,
 * a line break, and a link. A list item's own paragraph is rendered inline in
 * the item. A node of any other kind renders nothing, since `toTree` builds
 * none.
 */
function render(node: Mdast.Nodes, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{node.children.map(render)}</p>;
    case "list":
      return node.ordered ? (
        <ol key={key} className="pl-5 space-y-0.5 list-decimal">
          {node.children.map(render)}
        </ol>
      ) : (
        <ul key={key} className="pl-5 space-y-0.5 list-disc">
          {node.children.map(render)}
        </ul>
      );
    case "listItem":
      return (
        <li key={key} className="pl-0.5">
          {node.children.map((child, index) =>
            child.type === "paragraph" ? (
              <Fragment key={index}>{child.children.map(render)}</Fragment>
            ) : (
              render(child, index)
            ),
          )}
        </li>
      );
    case "strong":
      return (
        <strong key={key} className="font-semibold">
          {node.children.map(render)}
        </strong>
      );
    case "emphasis":
      return <em key={key}>{node.children.map(render)}</em>;
    case "link":
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="anchor"
        >
          {node.children.map(render)}
        </a>
      );
    case "break":
      return <br key={key} />;
    case "text":
      return <Fragment key={key}>{node.value}</Fragment>;
    default:
      return null;
  }
}

/**
 * A publication's comments, read from their Markdown: paragraphs, bulleted
 * and numbered lists, line breaks, bold and italic text, and links. A link
 * opens in a new tab and passes on neither the page nor its address. Renders
 * nothing when the comments are empty.
 *
 * Only the subset of Markdown that comments support is rendered (see
 * `modules/comments`), and raw HTML is shown as text, so the Markdown cannot
 * add markup of its own to the page.
 *
 * `size` sets the text: `base` for the publication's page, and `small` for a
 * denser place such as the history.
 */
const Comments: FC<{
  markdown: string | null | undefined;
  size?: "base" | "small";
}> = ({ markdown, size = "base" }) => {
  const tree = toTree(parse(markdown));

  return tree.children.length === 0 ? null : (
    <div
      data-size={size}
      className="space-y-2 text-gray-700 wrap-break-words data-[size=base]:text-sm data-[size=small]:text-xs data-[size=small]:space-y-1"
    >
      {tree.children.map(render)}
    </div>
  );
};

export default Comments;

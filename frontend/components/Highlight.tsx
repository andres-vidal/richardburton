import { FC } from "react";

/**
 * Renders text with the words the current search matched highlighted.
 *
 * The index returns each field's matching text with those words already wrapped
 * in `[[ ]]`, by the same configuration that decided the row matched. This
 * component renders each wrapped part in a `<mark>` with `className`, and
 * never decides for itself which words to highlight, so the highlighting cannot
 * drift from the search.
 *
 * Text with no markers in it renders unchanged, such as a field the search did
 * not match, or text shown outside a search.
 */
const Highlight: FC<{ children: string; className?: string }> = ({
  children,
  className = "text-inherit bg-amber-100",
}) => (
  <>
    {children.split(/\[\[|\]\]/).map((part, index) =>
      index % 2 === 0 ? (
        part
      ) : (
        <mark key={index} className={className}>
          {part}
        </mark>
      ),
    )}
  </>
);

export default Highlight;

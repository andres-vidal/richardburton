import { FC } from "react";

/**
 * Renders text with the words the current search matched highlighted.
 *
 * The index returns each field's matching text with those words already wrapped
 * in `[[ ]]`, worked out by the same configuration that decided the row matched
 * in the first place. This component only renders those markers; it never works
 * out for itself which words to highlight. That is what keeps what is shown as
 * the answer from drifting apart from what was actually searched.
 *
 * Text with no markers in it renders unchanged. That covers both a field the
 * search did not match and any text shown outside a search.
 */
const Highlight: FC<{ children: string | number; className?: string }> = ({
  children,
  className = "text-inherit bg-amber-100",
}) => (
  <>
    {/* `year` is held as a number, so what arrives here is not always the string
        the types promise. */}
    {String(children ?? "")
      .split(/\[\[|\]\]/)
      .map((part, index) =>
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

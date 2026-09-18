import { FC } from "react";

/**
 * Text with the words the current search matched picked out.
 *
 * The index returns each field's matching text with those words already wrapped
 * in `[[ ]]`, decided by the same configuration that decided the row matched at
 * all. This renders those marks rather than working out where they belong, so
 * what is shown as the answer and what was actually searched cannot drift apart.
 *
 * Text carrying no marks renders untouched — which is what a field the search
 * did not match, and any text read outside a search, comes back as.
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

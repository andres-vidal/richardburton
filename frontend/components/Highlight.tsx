"use client";

import { useKeywords } from "modules/publication/hooks";
import { highlight, searchWords } from "modules/publication/highlight";
import { useSearchParams } from "next/navigation";
import { FC, useMemo } from "react";

/**
 * Text with the words the current search matched picked out.
 *
 * Wherever a publication is shown while a search is on — a row of the index, a
 * record open over it — this marks the parts of it that answered, so a reader
 * can see what the query caught rather than inferring it. Outside a search
 * there are no matched words and the text renders untouched.
 *
 * The words to mark come from the search that loaded these rows, which returns
 * the indexed words it resolved to. A record opened over the index is its own
 * route, and so its own store, with no search behind it — there the address
 * still carries the term, and the reader's own words stand in, marking what
 * begins with them as the search itself would have widened them.
 */
const Highlight: FC<{ children: string }> = ({ children }) => {
  const keywords = useKeywords();
  const search = useSearchParams()?.get("search") ?? undefined;

  const parts = useMemo(() => {
    if (keywords && keywords.length > 0) return highlight(children, keywords);
    if (search)
      return highlight(children, searchWords(search), { prefix: true });
    return [{ text: children, matched: false }];
  }, [children, keywords, search]);

  return (
    <>
      {parts.map((part, index) =>
        part.matched ? (
          <mark key={index} className="text-inherit bg-amber-100">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
};

export default Highlight;

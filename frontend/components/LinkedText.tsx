import { FC } from "react";
import { bareUrl } from "modules/rich-text";

import Highlight from "./Highlight";

/** A stretch of text, and the URL it links to, or null when it is not a link. */
type Piece = { text: string; url: string | null };

// Returns the part of the text from `start` to `end`, counted without the
// `[[ ]]` markers, with markers around each part of it that `runs` marks.
// `runs` is the text split at its markers, so every other run is marked.
function sliceRuns(runs: string[], start: number, end: number): string {
  return runs.reduce(
    ({ offset, text }, run, index) => {
      const part = run.slice(
        Math.max(start - offset, 0),
        Math.max(end - offset, 0),
      );

      return {
        offset: offset + run.length,
        text: text + (part !== "" && index % 2 === 1 ? `[[${part}]]` : part),
      };
    },
    { offset: 0, text: "" },
  ).text;
}

// Returns `text` as the pieces it renders as: each bare URL in it, as
// `bareUrl` finds them, and the text between them. `text` may carry the
// `[[ ]]` markers `Highlight` renders. The markers do not count as part of a
// word, and each piece keeps the markers of its own text, so a URL with a
// marked word in it is still a URL.
function piecesOf(text: string): Piece[] {
  const runs = text.split(/\[\[|\]\]/);
  const plain = runs.join("");
  const links = [...plain.matchAll(/\S+/g)].flatMap((word) => {
    const link = bareUrl(word[0]);

    return link === null
      ? []
      : [
          {
            start: word.index,
            end: word.index + link.text.length,
            url: link.url,
          },
        ];
  });
  const edges = [
    0,
    ...links.flatMap(({ start, end }) => [start, end]),
    plain.length,
  ];

  return edges
    .slice(0, -1)
    .map((start, index) => ({
      text: sliceRuns(runs, start, edges[index + 1]),
      url: index % 2 === 1 ? links[(index - 1) / 2].url : null,
    }))
    .filter((piece) => piece.text !== "");
}

/**
 * Renders text with each bare URL in it as a link that opens in a new tab, and
 * the words a search matched highlighted as `Highlight` highlights them.
 *
 * A bare URL is a word that starts with `http://`, `https://` or `www.`, or an
 * email address, as notes recognize them. Punctuation that ends the word, such
 * as the full stop after a URL that ends a sentence, stays outside the link.
 */
const LinkedText: FC<{ children: string }> = ({ children }) => (
  <>
    {piecesOf(children).map(({ text, url }, index) =>
      url === null ? (
        <Highlight key={index}>{text}</Highlight>
      ) : (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="anchor"
        >
          <Highlight>{text}</Highlight>
        </a>
      ),
    )}
  </>
);

export default LinkedText;

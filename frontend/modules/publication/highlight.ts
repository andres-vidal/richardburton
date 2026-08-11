/** A run of text, marked when the search matched it. */
type Part = { text: string; matched: boolean };

/** The combining marks NFD splits an accented letter into. */
const DIACRITIC = /[̀-ͯ]/g;

/**
 * A word is a run of characters that are neither whitespace nor punctuation.
 * Written as what it excludes rather than as letters, so a script this database
 * has not seen yet still reads as words.
 */
const WORD = /[^\s!-/:-@[-`{-~]+/g;

/**
 * Fold text the way the index folds it — accents removed, lowercased — keeping,
 * for each folded character, the position of the character it came from. The
 * map is what lets a match found in the folded text be marked in the original,
 * so "Angústia" can be highlighted by a search for "angustia".
 */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = "";
  const origin: number[] = [];

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
      .normalize("NFD")
      .replace(DIACRITIC, "")
      .toLowerCase();

    for (let step = 0; step < character.length; step++) {
      folded += character[step];
      origin.push(index);
    }
  }

  return { folded, origin };
}

/**
 * The words of a search term, as something to mark by.
 *
 * Quotes are dropped — a quoted phrase is still matched word by word — and so
 * is a negated word, which the reader asked *not* to see and which therefore
 * cannot be why a record is here. `or` separates alternatives rather than being
 * searched for.
 */
function searchWords(term: string): string[] {
  return term
    .replace(/"/g, " ")
    .split(/\s+/)
    .filter(
      (word) => word !== "" && word[0] !== "-" && word.toLowerCase() !== "or",
    );
}

/**
 * Split text into runs, marking the words a search matched.
 *
 * Given the indexed words a search resolved to, a word is marked when it
 * matches one of them entirely: those are whole words, as the index holds them,
 * and the server has already widened a half-typed term into everything it
 * matched. Given the reader's own words instead — where the resolved ones are
 * not to hand — `prefix` marks a word that begins with one, which is how the
 * server widens a typed word in the first place.
 */
function highlight(
  text: string,
  keywords: string[],
  { prefix = false }: { prefix?: boolean } = {},
): Part[] {
  if (!text || keywords.length === 0) return [{ text, matched: false }];

  const wanted = keywords.map((keyword) => fold(keyword).folded);
  const matches = (word: string) =>
    prefix
      ? wanted.some((keyword) => keyword !== "" && word.indexOf(keyword) === 0)
      : wanted.indexOf(word) !== -1;

  const { folded, origin } = fold(text);
  const parts: Part[] = [];
  let taken = 0;

  WORD.lastIndex = 0;
  let word = WORD.exec(folded);

  while (word) {
    if (matches(word[0])) {
      const from = origin[word.index];
      const to = origin[word.index + word[0].length - 1] + 1;

      if (from > taken) {
        parts.push({ text: text.slice(taken, from), matched: false });
      }
      parts.push({ text: text.slice(from, to), matched: true });
      taken = to;
    }

    word = WORD.exec(folded);
  }

  if (taken < text.length) {
    parts.push({ text: text.slice(taken), matched: false });
  }

  return parts;
}

export { highlight, searchWords };
export type { Part };

import { describe, expect, test } from "vitest";
import { highlight, searchWords } from "./highlight";

/** The marked runs, in order — what a reader would see picked out. */
const marked = (text: string, keywords: string[]) =>
  highlight(text, keywords)
    .filter((part) => part.matched)
    .map((part) => part.text);

/** The whole text, reassembled — nothing may be lost or doubled. */
const rejoined = (text: string, keywords: string[]) =>
  highlight(text, keywords)
    .map((part) => part.text)
    .join("");

describe("highlight", () => {
  test("marks a matched word, leaving the rest alone", () => {
    expect(marked("Dom Casmurro", ["casmurro"])).toEqual(["Casmurro"]);
  });

  test("marks every occurrence, not only the first", () => {
    expect(marked("Assis, Machado de Assis", ["assis"])).toEqual([
      "Assis",
      "Assis",
    ]);
  });

  test("marks a word the reader wrote without its accents", () => {
    expect(marked("Angústia", ["angustia"])).toEqual(["Angústia"]);
  });

  test("marks a word the index holds without accents", () => {
    expect(marked("Iracema", ["iracema"])).toEqual(["Iracema"]);
  });

  test("matches whole words, so a keyword inside a longer word is left alone", () => {
    expect(marked("Casmurros", ["casmurro"])).toEqual([]);
  });

  test("marks each of several keywords", () => {
    expect(marked("Machado de Assis", ["machado", "assis"])).toEqual([
      "Machado",
      "Assis",
    ]);
  });

  test("keeps the text whole, whatever is marked", () => {
    const text = "Gabriela, Clove and Cinnamon";
    expect(rejoined(text, ["clove"])).toBe(text);
    expect(rejoined(text, [])).toBe(text);
    expect(rejoined(text, ["nothing"])).toBe(text);
  });

  test("without a search there is nothing to mark", () => {
    expect(highlight("Dom Casmurro", [])).toEqual([
      { text: "Dom Casmurro", matched: false },
    ]);
  });

  test("empty text stays empty", () => {
    expect(highlight("", ["assis"])).toEqual([{ text: "", matched: false }]);
  });

  test("a word against punctuation is still a word", () => {
    expect(marked("Assis, Joaquim", ["assis"])).toEqual(["Assis"]);
    expect(marked("(Machado)", ["machado"])).toEqual(["Machado"]);
  });

  test("marks a word among many, in the order they appear", () => {
    expect(
      highlight("Barren Lives", ["lives"]).map((p) => [p.text, p.matched]),
    ).toEqual([
      ["Barren ", false],
      ["Lives", true],
    ]);
  });
});

describe("highlight, marking by what a word begins with", () => {
  const prefixed = (text: string, keywords: string[]) =>
    highlight(text, keywords, { prefix: true })
      .filter((part) => part.matched)
      .map((part) => part.text);

  test("marks the word a half-typed one could still become", () => {
    expect(prefixed("Machado de Assis", ["mach"])).toEqual(["Machado"]);
  });

  test("marks a complete word too", () => {
    expect(prefixed("Dom Casmurro", ["casmurro"])).toEqual(["Casmurro"]);
  });

  test("still folds accents away", () => {
    expect(prefixed("Iraçéma the Honey-Lips", ["iracema"])).toEqual([
      "Iraçéma",
    ]);
  });

  test("a word that begins with nothing asked for is left alone", () => {
    expect(prefixed("Dom Casmurro", ["assis"])).toEqual([]);
  });
});

describe("searchWords", () => {
  test("takes the words a reader typed", () => {
    expect(searchWords("Machado de Assis")).toEqual(["Machado", "de", "Assis"]);
  });

  test("reads a quoted phrase as its words", () => {
    expect(searchWords('"United Kingdom"')).toEqual(["United", "Kingdom"]);
  });

  test("drops a word the reader excluded, which cannot be why a record is here", () => {
    expect(searchWords("Verissimo -Noite")).toEqual(["Verissimo"]);
  });

  test("drops the word that separates alternatives", () => {
    expect(searchWords("Verissimo or Assis")).toEqual(["Verissimo", "Assis"]);
  });
});

import {
  ATTRIBUTES,
  contrast,
  define,
  empty,
  errorCode,
  markedSources,
  marking,
  merged,
  searchHref,
  shownNotes,
  sourceLine,
  sourceOf,
} from "./model";
import type { Publication } from "./model";
import { routing } from "i18n/routing";
import { messages } from "test/messages";
import { source } from "test/publication-fixtures";
import { item, link, paragraph } from "test/rich-text-fixtures";

const COUNTRIES = messages.countryNames;

// A reader reading in the default locale, who names countries the way the
// server does. The naming is a function rather than a hook, so what a reader
// sees can be checked without rendering anything.
const read = marking(routing.defaultLocale, {
  name: (code) => COUNTRIES[code as keyof typeof COUNTRIES] ?? code,
  article: () => "",
});

const markedValue = read.value;
const markedItems = read.items;

describe("empty", () => {
  test("returns a publication with every attribute blank", () => {
    const publication = empty();

    // Every model attribute is present and empty — the shape editing relies
    // on. A multi-valued one is empty by holding nothing.
    ATTRIBUTES.forEach((key) => {
      const value = publication[key];
      expect(Array.isArray(value) ? value : [value].filter(Boolean)).toEqual(
        [],
      );
    });
    // Plus a null id (no server PK yet) and an empty provenance list. Sources
    // are a list outside the scalar ATTRIBUTES, so they're checked separately.
    expect(publication.id).toBeNull();
    expect(publication.sources).toEqual([]);
    expect(Object.keys(publication).sort()).toEqual(
      ["id", "sources", ...ATTRIBUTES].sort(),
    );
  });
});

describe("markedValue", () => {
  const [first, second] = Object.keys(COUNTRIES);

  function holding(fields: Partial<Publication>): Publication {
    return { ...empty(), ...fields };
  }

  test("names the country a code stands for", () => {
    expect(markedValue(holding({ countries: [first] }), "countries")).toBe(
      COUNTRIES[first],
    );
  });

  test("names every code of a list — what a merged record holds", () => {
    expect(
      markedValue(holding({ countries: [first, second] }), "countries"),
    ).toBe(`${COUNTRIES[first]}, ${COUNTRIES[second]}`);
  });

  test("a code it has no name for is read as the code", () => {
    // One unknown code in a list does not cost the others their names.
    expect(
      markedValue(holding({ countries: [first, "__nope__"] }), "countries"),
    ).toBe(`${COUNTRIES[first]}, __nope__`);
  });

  test("passes non-country values through untouched", () => {
    expect(markedValue(holding({ year: "1953" }), "year")).toBe("1953");

    expect(
      markedValue(holding({ authors: ["Helen Caldwell"] }), "authors"),
    ).toBe("Helen Caldwell");
  });

  test("the index's marks win over the stored value", () => {
    expect(
      markedValue(
        holding({
          authors: ["Helen Caldwell"],
          excerpts: { authors: "Helen [[Caldwell]]" },
        }),
        "authors",
      ),
    ).toBe("Helen [[Caldwell]]");
  });

  // The index says which countries answered a search; the whole name is marked,
  // since the name that matched is not always the name being read.
  test("marks the country the index says answered the search", () => {
    expect(
      markedValue(
        holding({ countries: [first], marked: { countries: [first] } }),
        "countries",
      ),
    ).toBe(`[[${COUNTRIES[first]}]]`);
  });

  test("leaves the countries beside it unmarked", () => {
    expect(
      markedValue(
        holding({
          countries: [first, second],
          marked: { countries: [null, second] },
        }),
        "countries",
      ),
    ).toBe(`${COUNTRIES[first]}, [[${COUNTRIES[second]}]]`);
  });

  test("marks nothing when the search answered on another field", () => {
    expect(
      markedValue(
        holding({ countries: [first], marked: { countries: [null] } }),
        "countries",
      ),
    ).toBe(COUNTRIES[first]);
  });
});

describe("markedItems", () => {
  const [first, second] = Object.keys(COUNTRIES);

  function holding(fields: Partial<Publication>): Publication {
    return { ...empty(), ...fields };
  }

  test("pairs each country's code with its name", () => {
    expect(
      markedItems(holding({ countries: [first, second] }), "countries"),
    ).toEqual([
      { value: first, label: COUNTRIES[first] },
      { value: second, label: COUNTRIES[second] },
    ]);
  });

  test("marks only the country that answered, keeping its code addressable", () => {
    expect(
      markedItems(
        holding({
          countries: [first, second],
          marked: { countries: [first, null] },
        }),
        "countries",
      ),
    ).toEqual([
      { value: first, label: `[[${COUNTRIES[first]}]]` },
      { value: second, label: COUNTRIES[second] },
    ]);
  });
});

describe("errorCode", () => {
  test("no error is an empty code, with or without a scope", () => {
    expect(errorCode(null)).toBe("");
    expect(errorCode(null, "title")).toBe("");
  });

  test("a row-level error answers its code when unscoped", () => {
    expect(errorCode("conflict")).toBe("conflict");
  });

  test("a row-level error is silent when asked about a field", () => {
    // String = whole-row error; it must not leak into an individual cell.
    expect(errorCode("conflict", "title")).toBe("");
  });

  test("a field-error map is silent at the row level", () => {
    // Record = per-field errors; there is no single row code to show.
    expect(errorCode({ title: "required" } as never)).toBe("");
  });

  test("a field-error map answers the code for the scoped field", () => {
    const errors = { title: "required", year: "integer" } as never;

    expect(errorCode(errors, "title")).toBe("required");
    expect(errorCode(errors, "year")).toBe("integer");
  });
});

describe("define", () => {
  test("bounds year between 0 and the current year", () => {
    expect(define("year")).toEqual({ min: 0, max: new Date().getFullYear() });
  });

  test("has no constraints for other attributes", () => {
    expect(define("title")).toEqual({});
    expect(define("authors")).toEqual({});
  });
});

describe("merged", () => {
  const publication = (fields: Partial<Publication>): Publication => ({
    ...empty(),
    ...fields,
  });

  test("keeps the survivor's own identity", () => {
    const winner = publication({ id: 1, title: "Iracema", year: "1886" });
    const loser = publication({ id: 2, title: "Iraçéma", year: "1922" });

    const result = merged(winner, [loser]);

    expect(result.id).toBe(1);
    expect(result.title).toBe("Iracema");
    expect(result.year).toBe("1886");
  });

  test("unions the countries and publishers of all of them", () => {
    const winner = publication({
      countries: ["GB"],
      publishers: ["Bickers & Son"],
    });
    const losers = [
      publication({ countries: ["US", "GB"], publishers: ["Noonday Press"] }),
      publication({ countries: ["BR"], publishers: ["Bickers & Son"] }),
    ];

    const result = merged(winner, losers);

    expect(result.countries).toEqual(["BR", "GB", "US"]);
    expect(result.publishers).toEqual(["Bickers & Son", "Noonday Press"]);
  });

  test("takes every source none of the others already gave", () => {
    const winner = publication({ sources: [source("Alves, 1990")] });
    const losers = [
      publication({ sources: [source("Alves, 1990"), source("Costa, 2001")] }),
      publication({ sources: [source(null, "Dias, 2011")] }),
    ];

    expect(merged(winner, losers).sources).toEqual([
      source("Alves, 1990"),
      source("Costa, 2001"),
      source(null, "Dias, 2011"),
    ]);
  });

  test("joins a source that repeats a kept one into it, taking the language the kept one lacks", () => {
    const winner = publication({
      sources: [source("Alves, Introdução, 1990")],
    });
    const losers = [
      publication({
        sources: [
          source("Alves, Introdução, 1990", "Alves, Introduction, 1990"),
          // The same English text as the first source, and no Portuguese
          // text that differs from it, so it repeats it.
          source(null, "Alves, Introduction, 1990"),
          // Its English text differs from the first source's, so it is a
          // source of its own, though its Portuguese text is the same.
          source("Alves, Introdução, 1990", "Alves, Preface, 1990"),
        ],
      }),
    ];

    expect(merged(winner, losers).sources).toEqual([
      source("Alves, Introdução, 1990", "Alves, Introduction, 1990"),
      source("Alves, Introdução, 1990", "Alves, Preface, 1990"),
    ]);
  });

  test("appends the blocks of the others' distinct notes to the survivor's, in each language", () => {
    const first = [paragraph("Primeira edição.")];
    const review = [
      paragraph("Resenhado em ", { text: "The Athenaeum", italic: true }, "."),
      item("bulleted", 0, "", link("https://example.com/r", "a resenha"), ""),
    ];
    const english = [paragraph("First edition.")];
    const losers = [
      publication({ notesPt: review, notesEn: english }),
      // The survivor's notes again, with the keys of each object in another
      // order, as JSON from the API may list them.
      publication({
        notesPt: [
          { children: [{ text: "Primeira edição." }], type: "paragraph" },
        ],
      }),
      publication({ notesPt: null }),
      publication({ notesPt: [paragraph("  "), item("numbered", 0, "")] }),
      publication({}),
    ];

    const result = merged(publication({ notesPt: first }), losers);

    expect(result.notesPt).toEqual([...first, ...review]);
    expect(result.notesEn).toEqual(english);
  });

  test("takes the others' notes when the survivor has none", () => {
    const winner = publication({ notesPt: null, notesEn: null });
    const list = [item("bulleted", 0, "a list")];

    expect(merged(winner, [publication({ notesEn: list })]).notesEn).toEqual(
      list,
    );
    expect(merged(winner, [publication({})]).notesPt).toBeNull();
  });

  test("merging nothing in leaves the record as it stands", () => {
    const winner = publication({
      countries: ["GB", "US"],
      publishers: ["Bickers & Son"],
      sources: [source("Alves, 1990")],
    });

    expect(merged(winner, [])).toEqual(winner);
  });
});

describe("markedSources", () => {
  const publication = (fields: Partial<Publication>): Publication => ({
    ...empty(),
    ...fields,
  });

  test("shows each source in the reader's language, or in the other one when it has none in the reader's", () => {
    const record = publication({
      sources: [
        source(
          "Caldwell, Helen. Introdução.",
          "Caldwell, Helen. Introduction.",
        ),
        source("Gledson, John. Realismo enganoso."),
        source(null, "Catalog record."),
        source("  ", null),
      ],
    });

    expect(markedSources(record, "en")).toEqual([
      { language: "en", text: "Caldwell, Helen. Introduction." },
      { language: "pt", text: "Gledson, John. Realismo enganoso." },
      { language: "en", text: "Catalog record." },
    ]);
    expect(markedSources(record, "pt")).toEqual([
      { language: "pt", text: "Caldwell, Helen. Introdução." },
      { language: "pt", text: "Gledson, John. Realismo enganoso." },
      { language: "en", text: "Catalog record." },
    ]);
  });

  test("shows the marked text of the language it shows, where the search matched it", () => {
    const record = publication({
      sources: [
        source(
          "Caldwell, Helen. Introdução.",
          "Caldwell, Helen. Introduction.",
        ),
        source("Gledson, John."),
      ],
      marked: {
        sources: [{ pt: null, en: "[[Caldwell]], Helen. Introduction." }, null],
      },
    });

    expect(markedSources(record, "en")).toEqual([
      { language: "en", text: "[[Caldwell]], Helen. Introduction." },
      { language: "pt", text: "Gledson, John." },
    ]);
    expect(markedSources(record, "pt")[0]).toEqual({
      language: "pt",
      text: "Caldwell, Helen. Introdução.",
    });
  });
});

describe("shownNotes", () => {
  test("shows the notes in the reader's language, or in the other one when those are blank", () => {
    const portuguese = [paragraph("Primeira edição.")];
    const english = [paragraph("First edition.")];

    expect(shownNotes({ notesPt: portuguese, notesEn: english }, "en")).toEqual(
      { language: "en", value: english },
    );
    expect(
      shownNotes({ notesPt: portuguese, notesEn: [paragraph(" ")] }, "en"),
    ).toEqual({ language: "pt", value: portuguese });
    expect(shownNotes({ notesPt: null }, "pt")).toBeNull();
  });
});

describe("sourceOf", () => {
  test("reads a string, the shape of a source before it had two languages, as a source in Portuguese", () => {
    expect(sourceOf("Caldwell, Helen.")).toEqual(source("Caldwell, Helen."));
    expect(sourceOf({ pt: "Caldwell", en: "Caldwell, Helen." })).toEqual(
      source("Caldwell", "Caldwell, Helen."),
    );
    expect(sourceOf({ en: 3 })).toEqual(source(null));
  });
});

describe("sourceLine", () => {
  test("joins the texts a source has, Portuguese first", () => {
    expect(sourceLine(source("Introdução", "Introduction"))).toBe(
      "Introdução / Introduction",
    );
    expect(sourceLine(source(" ", "Introduction"))).toBe("Introduction");
  });
});

describe("contrast", () => {
  const publication = (fields: Partial<Publication>): Publication => ({
    ...empty(),
    title: "Dom Casmurro",
    authors: ["Helen Caldwell"],
    year: "1953",
    countries: ["US"],
    publishers: ["Noonday Press"],
    ...fields,
  });

  test("marks the words of a field that another record lacks", () => {
    const typo = publication({ title: "Dom Casmuro" });

    expect(contrast(typo, [publication({})], "title").values).toEqual([
      [
        { text: "Dom ", differs: false },
        { text: "Casmuro", differs: true },
      ],
    ]);
  });

  test("marks nothing in a field the records agree on", () => {
    const typo = publication({ title: "Dom Casmuro" });

    expect(contrast(typo, [publication({})], "authors")).toEqual({
      values: [[{ text: "Helen Caldwell", differs: false }]],
      lacking: false,
    });
  });

  test("joins neighbouring words that differ into one stretch", () => {
    const variant = publication({ publishers: ["The New Noonday Press"] });

    expect(contrast(variant, [publication({})], "publishers").values).toEqual([
      [
        { text: "The New", differs: true },
        { text: " Noonday Press", differs: false },
      ],
    ]);
  });

  test("counts a change of case or accent as a difference", () => {
    const record = publication({ publishers: ["Noonday press"] });
    const accented = publication({ title: "Dom Casmurrô" });

    expect(contrast(record, [publication({})], "publishers").values).toEqual([
      [
        { text: "Noonday ", differs: false },
        { text: "press", differs: true },
      ],
    ]);
    expect(contrast(accented, [publication({})], "title").values[0][1]).toEqual(
      { text: "Casmurrô", differs: true },
    );
  });

  test("finds a word anywhere in the other record's field, not only in the same value", () => {
    const two = publication({ authors: ["Helen Caldwell", "John Gledson"] });
    const swapped = publication({
      authors: ["John Gledson", "Helen Caldwell"],
    });

    expect(contrast(two, [swapped], "authors").values).toEqual([
      [{ text: "Helen Caldwell", differs: false }],
      [{ text: "John Gledson", differs: false }],
    ]);
  });

  test("marks a word that any one of several records lacks", () => {
    const typo = publication({ title: "Dom Casmuro" });
    const retitled = publication({ title: "The Confessions of a Jealous Man" });

    expect(contrast(publication({}), [typo, retitled], "title").values).toEqual(
      [[{ text: "Dom Casmurro", differs: true }]],
    );
    expect(contrast(typo, [publication({}), typo], "title").values).toEqual([
      [
        { text: "Dom ", differs: false },
        { text: "Casmuro", differs: true },
      ],
    ]);
  });

  test("compares years, countries and the texts of sources as whole values", () => {
    const record = publication({
      year: "1953",
      countries: ["US", "GB"],
      sources: [
        source(null, "Caldwell, Helen. Introduction."),
        source("Gledson, John. Deceptive Realism."),
      ],
    });
    const other = publication({
      year: "1953",
      countries: ["US"],
      sources: [source("Gledson, John. Deceptive Realism.")],
    });

    expect(contrast(record, [other], "year").values).toEqual([
      [{ text: "1953", differs: false }],
    ]);
    expect(contrast(record, [other], "countries").values).toEqual([
      [{ text: "US", differs: false }],
      [{ text: "GB", differs: true }],
    ]);
    expect(contrast(record, [other], "sources").values).toEqual([
      [{ text: "Caldwell, Helen. Introduction.", differs: true }],
      [{ text: "Gledson, John. Deceptive Realism.", differs: false }],
    ]);
  });

  test("reads a year that arrives as a number", () => {
    const stored = publication({ year: 1953 as unknown as string });

    expect(
      contrast(stored, [publication({ year: "1966" })], "year").values,
    ).toEqual([[{ text: "1953", differs: true }]]);
  });

  test("says when a field is empty and another record fills it", () => {
    const bare = publication({ publishers: [] });

    expect(contrast(bare, [publication({})], "publishers")).toEqual({
      values: [],
      lacking: true,
    });
    expect(contrast(publication({}), [bare], "publishers").values).toEqual([
      [{ text: "Noonday Press", differs: true }],
    ]);
    expect(contrast(bare, [bare], "publishers").lacking).toBe(false);
  });

  test("marks nothing when there is nothing to compare with", () => {
    expect(contrast(publication({}), [], "title")).toEqual({
      values: [[{ text: "Dom Casmurro", differs: false }]],
      lacking: false,
    });
  });
});

describe("searchHref", () => {
  test("links to the index with the term encoded", () => {
    expect(searchHref("Machado de Assis")).toBe("/?search=Machado+de+Assis");
    expect(searchHref("author:Lispector & co")).toBe(
      "/?search=author%3ALispector+%26+co",
    );
  });

  test("links to the path alone when there is no term", () => {
    expect(searchHref(undefined)).toBe("/");
    expect(searchHref(null, "/insights")).toBe("/insights");
    expect(searchHref("")).toBe("/");
  });

  test("gives only the query string for an empty path", () => {
    expect(searchHref("clarke", "")).toBe("?search=clarke");
  });

  test("puts other parameters before the term", () => {
    expect(searchHref("Iracema", "/publications/1", { modal: "" })).toBe(
      "/publications/1?modal=&search=Iracema",
    );
    expect(searchHref(undefined, "/publications/1", { modal: "" })).toBe(
      "/publications/1?modal=",
    );
  });
});

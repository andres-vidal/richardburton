import { describe, expect, it, vi } from "vitest";
import {
  EVERY_FORMAT,
  item,
  link,
  paragraph,
  unchecked,
} from "test/rich-text-fixtures";
import {
  bareUrl,
  emptyValue,
  isBlank,
  isLongerThan,
  linkBareUrls,
  linkTarget,
  markedParagraph,
  plainText,
  readValue,
  safeUrl,
  textLength,
} from "./rich-text";

describe("emptyValue", () => {
  it("is one empty paragraph, a new one each time", () => {
    expect(emptyValue()).toEqual([paragraph("")]);
    expect(emptyValue()).not.toBe(emptyValue());
  });
});

describe("plainText", () => {
  it("reads a value as one line of text, links included", () => {
    expect(plainText(EVERY_FORMAT)).toBe(
      "A bold claim and an italic aside. A second line, with the guide. Fruit Apples Pears Bread",
    );
  });

  it("reads null and blank values as an empty string", () => {
    expect(plainText(null)).toBe("");
    expect(plainText(undefined)).toBe("");
    expect(plainText([paragraph(" \n "), item("bulleted", 0, "")])).toBe("");
  });

  it("reads a value that is not rich text as the text it holds", () => {
    expect(plainText(unchecked("Two editions:\n- *1965*"))).toBe(
      "Two editions: - *1965*",
    );
    expect(
      plainText(
        unchecked([
          paragraph("Before."),
          { type: "block-quote", children: [{ text: "Quoted." }] },
        ]),
      ),
    ).toBe("Before. Quoted.");
    expect(plainText(unchecked(42))).toBe("");
  });
});

describe("readValue", () => {
  it("returns a value of rich text as it is", () => {
    expect(readValue(EVERY_FORMAT)).toEqual(EVERY_FORMAT);
    expect(readValue([paragraph(""), item("bulleted", 3, "deep")])).toEqual([
      paragraph(""),
      item("bulleted", 3, "deep"),
    ]);
  });

  it("reads null as an empty value", () => {
    expect(readValue(null)).toEqual([]);
    expect(readValue(undefined)).toEqual([]);
  });

  it("reads a string as a paragraph of its text, line breaks kept", () => {
    expect(readValue("# Title\n\n*Two* lines")).toEqual([
      paragraph("# Title\n\n*Two* lines"),
    ]);
    expect(readValue("")).toEqual([]);
  });

  it("reads a node of another type as a paragraph of the text it holds", () => {
    expect(
      readValue([
        {
          type: "block-quote",
          children: [paragraph("A quoted "), { text: "line." }],
        },
        { type: "divider", children: [] },
        "A string block.",
        7,
      ]),
    ).toEqual([paragraph("A quoted line."), paragraph("A string block.")]);
    expect(readValue({ type: "heading", text: "Notes" })).toEqual([
      paragraph("Notes"),
    ]);
  });

  it("reads an inline of another type as a run of the text it holds", () => {
    expect(
      readValue([
        paragraph(
          "See ",
          { type: "mention", children: [{ text: "Ana" }] } as never,
          link("https://example.com", { type: "code", text: "x" } as never),
        ),
        { type: "paragraph", children: [] },
      ]),
    ).toEqual([
      paragraph("See ", "Ana", link("https://example.com", "x")),
      paragraph(""),
    ]);
  });
});

describe("textLength", () => {
  it("counts the characters of the runs, links included, with nothing between blocks", () => {
    expect(
      textLength([
        paragraph("ab\nc", link("https://example.com", "de")),
        item("bulleted", 0, "f"),
      ]),
    ).toBe(7);
    expect(textLength(null)).toBe(0);
    expect(textLength(emptyValue())).toBe(0);
  });

  it("counts a grapheme of several code points as one character", () => {
    // An "e" and a combining acute accent, a family emoji of seven code
    // points, and a flag of two regional indicators.
    expect(textLength([paragraph("e\u0301", "👨‍👩‍👧‍👦", "🇧🇷")])).toBe(3);
  });

  it("counts the text a value that is not rich text holds", () => {
    expect(textLength(unchecked("café"))).toBe(4);
  });
});

describe("isLongerThan", () => {
  it("holds when the text has more characters than the limit", () => {
    expect(isLongerThan([paragraph("abc")], 3)).toBe(false);
    expect(isLongerThan([paragraph("ab"), item("bulleted", 0, "cd")], 3)).toBe(
      true,
    );
    expect(isLongerThan(null, 0)).toBe(false);
  });

  it("counts characters, not code units, past the limit", () => {
    // Two letters, each an "e" and a combining acute accent: four code units.
    expect(isLongerThan([paragraph("e\u0301e\u0301")], 3)).toBe(false);
    expect(isLongerThan([paragraph("e\u0301e\u0301")], 1)).toBe(true);
  });

  it("splits no text into graphemes when it has no more code units than the limit", () => {
    const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");

    expect(isLongerThan([paragraph("A short note.")], 100)).toBe(false);
    expect(segment).not.toHaveBeenCalled();

    segment.mockRestore();
  });
});

describe("isBlank", () => {
  it("holds for null and for values of white space alone", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(emptyValue())).toBe(true);
    expect(isBlank([paragraph("  "), item("numbered", 1, "\n")])).toBe(true);
  });

  it("does not hold for a value with text, in a run or a link", () => {
    expect(isBlank([paragraph(""), paragraph("a")])).toBe(false);
    expect(
      isBlank([paragraph("", link("https://example.com", "site"), "")]),
    ).toBe(false);
  });

  it("reads a value that is not rich text by the text it holds", () => {
    expect(isBlank(unchecked(" \n "))).toBe(true);
    expect(isBlank(unchecked({ type: "divider" }))).toBe(true);
    expect(isBlank(unchecked("A note"))).toBe(false);
    expect(
      isBlank(unchecked([{ type: "quote", children: [{ text: "A" }] }])),
    ).toBe(false);
  });
});

describe("linkBareUrls", () => {
  it("links bare URLs and email addresses, leaving the punctuation after them", () => {
    expect(
      linkBareUrls([
        {
          text: "Read https://example.com/docs/guide, www.example.com or ask a@b.org.",
        },
      ]),
    ).toEqual([
      { text: "Read " },
      link("https://example.com/docs/guide", "https://example.com/docs/guide"),
      { text: ", " },
      link("https://www.example.com", "www.example.com"),
      { text: " or ask " },
      link("mailto:a@b.org", "a@b.org"),
      { text: "." },
    ]);
  });

  it("gives a link the marks of the run it was in", () => {
    expect(
      linkBareUrls([{ text: "see https://x.org now", bold: true }]),
    ).toEqual([
      { text: "see ", bold: true },
      link("https://x.org", { text: "https://x.org", bold: true }),
      { text: " now", bold: true },
    ]);
  });

  it("keeps links, and runs without a bare URL, as they are", () => {
    const inlines = [
      { text: "A ", italic: true },
      link("https://example.com", "https://other.org"),
      { text: "\nplain text, e.g. example.com" },
    ];

    expect(linkBareUrls(inlines)).toEqual(inlines);
  });
});

describe("markedParagraph", () => {
  it("makes a paragraph of the text, with its bare URLs as links", () => {
    expect(
      markedParagraph(
        "Catalog record, https://catalog.hathitrust.org/Record/001270334.",
      ),
    ).toEqual([
      paragraph(
        "Catalog record, ",
        link(
          "https://catalog.hathitrust.org/Record/001270334",
          "https://catalog.hathitrust.org/Record/001270334",
        ),
        ".",
      ),
    ]);
  });

  it("highlights the words between markers", () => {
    expect(markedParagraph("Pontiero, Giovanni. [[Afterword]].")).toEqual([
      paragraph(
        "Pontiero, Giovanni. ",
        { text: "Afterword", highlight: true },
        ".",
      ),
    ]);
  });

  it("keeps a URL whole when a matched word is inside it", () => {
    expect(
      markedParagraph("Scan: https://[[archive]].org/details/iracema, p. 7"),
    ).toEqual([
      paragraph(
        "Scan: ",
        link(
          "https://archive.org/details/iracema",
          "https://",
          { text: "archive", highlight: true },
          ".org/details/iracema",
        ),
        ", p. 7",
      ),
    ]);
  });

  it("highlights a stretch that runs into a link and out of it", () => {
    expect(markedParagraph("[[see www.x.org]] now")).toEqual([
      paragraph(
        { text: "see ", highlight: true },
        link("https://www.x.org", { text: "www.x.org", highlight: true }),
        " now",
      ),
    ]);
  });

  it("makes a paragraph with one empty run of empty text", () => {
    expect(markedParagraph("")).toEqual([paragraph("")]);
  });
});

describe("safeUrl", () => {
  it("accepts http, https and mailto URLs only", () => {
    expect(safeUrl(" https://example.com ")).toBe("https://example.com");
    expect(safeUrl("HTTP://example.com")).toBe("HTTP://example.com");
    expect(safeUrl("mailto:a@b.org")).toBe("mailto:a@b.org");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("ftp://example.com")).toBeNull();
    expect(safeUrl("/relative")).toBeNull();
    expect(safeUrl("https://")).toBeNull();
  });
});

describe("linkTarget", () => {
  it("completes what a person types as a link's address", () => {
    expect(linkTarget("https://example.com")).toBe("https://example.com");
    expect(linkTarget("example.com/page")).toBe("https://example.com/page");
    expect(linkTarget("www.example.com")).toBe("https://www.example.com");
    expect(linkTarget("a@b.org")).toBe("mailto:a@b.org");
    expect(linkTarget("not a url")).toBeNull();
    expect(linkTarget("javascript:alert(1)")).toBeNull();
    expect(linkTarget("")).toBeNull();
  });
});

describe("bareUrl", () => {
  it("links words that start with a scheme or www., and email addresses", () => {
    expect(bareUrl("https://example.com/a.")).toEqual({
      text: "https://example.com/a",
      url: "https://example.com/a",
    });
    expect(bareUrl("www.example.com,")).toEqual({
      text: "www.example.com",
      url: "https://www.example.com",
    });
    expect(bareUrl("a@b.org")).toEqual({
      text: "a@b.org",
      url: "mailto:a@b.org",
    });
    expect(bareUrl("example.com")).toBeNull();
    expect(bareUrl("e.g.")).toBeNull();
  });
});

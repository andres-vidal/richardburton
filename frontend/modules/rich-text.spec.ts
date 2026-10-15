import { describe, expect, it } from "vitest";
import {
  bareUrl,
  linkTarget,
  parse,
  plainText,
  safeUrl,
  serialize,
  type RichTextValue,
} from "./rich-text";

// Parses `markdown` and writes it back.
const roundTrip = (markdown: string) => serialize(parse(markdown));

describe("parse", () => {
  it("reads empty Markdown as one empty paragraph", () => {
    const empty = [{ type: "paragraph", children: [{ text: "" }] }];

    expect(parse(null)).toEqual(empty);
    expect(parse("")).toEqual(empty);
    expect(parse("  \n\n ")).toEqual(empty);
  });

  it("reads paragraphs, line breaks, bold and italic text", () => {
    expect(
      parse("A **bold** and *italic* word.\\\nNext line\n\nSecond"),
    ).toEqual([
      {
        type: "paragraph",
        children: [
          { text: "A " },
          { text: "bold", bold: true },
          { text: " and " },
          { text: "italic", italic: true },
          { text: " word.\nNext line" },
        ],
      },
      { type: "paragraph", children: [{ text: "Second" }] },
    ]);
  });

  it("reads a soft line break as a line break", () => {
    expect(parse("one\ntwo")).toEqual([
      { type: "paragraph", children: [{ text: "one\ntwo" }] },
    ]);
  });

  it("reads emphasis inside a link onto the link's text", () => {
    expect(
      parse("See [the **first** draft](https://example.com/draft)."),
    ).toEqual([
      {
        type: "paragraph",
        children: [
          { text: "See " },
          {
            type: "link",
            url: "https://example.com/draft",
            children: [
              { text: "the " },
              { text: "first", bold: true },
              { text: " draft" },
            ],
          },
          { text: "." },
        ],
      },
    ]);
  });

  it("links bare URLs and email addresses", () => {
    expect(
      parse(
        "Read https://example.com/docs/guide, www.example.com or ask a@b.org.",
      ),
    ).toEqual([
      {
        type: "paragraph",
        children: [
          { text: "Read " },
          {
            type: "link",
            url: "https://example.com/docs/guide",
            children: [{ text: "https://example.com/docs/guide" }],
          },
          { text: ", " },
          {
            type: "link",
            url: "http://www.example.com",
            children: [{ text: "www.example.com" }],
          },
          { text: " or ask " },
          {
            type: "link",
            url: "mailto:a@b.org",
            children: [{ text: "a@b.org" }],
          },
          { text: "." },
        ],
      },
    ]);
  });

  it("reads nested lists as items one level deeper", () => {
    expect(parse("- Editions\n  1. First\n  2. Second\n- Reviews")).toEqual([
      {
        type: "list-item",
        list: "bulleted",
        depth: 0,
        children: [{ text: "Editions" }],
      },
      {
        type: "list-item",
        list: "numbered",
        depth: 1,
        children: [{ text: "First" }],
      },
      {
        type: "list-item",
        list: "numbered",
        depth: 1,
        children: [{ text: "Second" }],
      },
      {
        type: "list-item",
        list: "bulleted",
        depth: 0,
        children: [{ text: "Reviews" }],
      },
    ]);
  });

  it("keeps lists nested deeper than the editor allows at its deepest level", () => {
    const depths = parse("- a\n  - b\n    - c\n      - d").map((block) =>
      block.type === "list-item" ? block.depth : null,
    );

    expect(depths).toEqual([0, 1, 2, 2]);
  });

  it("joins the paragraphs of a list item into its text, one line each", () => {
    expect(parse("- First\n\n  More of it")).toEqual([
      {
        type: "list-item",
        list: "bulleted",
        depth: 0,
        children: [{ text: "First\nMore of it" }],
      },
    ]);
  });

  it("keeps the text of headings, code and quotes as paragraphs", () => {
    expect(
      parse(
        "# A heading\n\n> Quoted *words*\n\n```\nsome code\nmore\n```\n\nUse `x`.",
      ),
    ).toEqual([
      { type: "paragraph", children: [{ text: "A heading" }] },
      {
        type: "paragraph",
        children: [{ text: "Quoted " }, { text: "words", italic: true }],
      },
      { type: "paragraph", children: [{ text: "some code\nmore" }] },
      { type: "paragraph", children: [{ text: "Use x." }] },
    ]);
  });

  it("keeps raw HTML as text rather than markup", () => {
    expect(parse("<script>alert(1)</script>\n\nA <b>bold</b> claim")).toEqual([
      { type: "paragraph", children: [{ text: "<script>alert(1)</script>" }] },
      { type: "paragraph", children: [{ text: "A <b>bold</b> claim" }] },
    ]);
  });

  it("keeps an image's alternative text, or its URL when it has none", () => {
    expect(
      parse("![The cover](https://x.org/c.png) ![](https://x.org/d.png)"),
    ).toEqual([
      {
        type: "paragraph",
        children: [{ text: "The cover https://x.org/d.png" }],
      },
    ]);
  });

  it("drops a link to anything but http, https or mailto to its label", () => {
    expect(
      parse(
        "[run](javascript:alert(1)) [file](file:///etc/passwd) [here](/relative)",
      ),
    ).toEqual([{ type: "paragraph", children: [{ text: "run file here" }] }]);
  });

  it("reads reference links through their definitions", () => {
    expect(parse("See [the record][r].\n\n[r]: https://example.com/r")).toEqual(
      [
        {
          type: "paragraph",
          children: [
            { text: "See " },
            {
              type: "link",
              url: "https://example.com/r",
              children: [{ text: "the record" }],
            },
            { text: "." },
          ],
        },
      ],
    );
  });

  it("shows a link with no label by its URL", () => {
    expect(parse("[](mailto:a@b.org)")).toEqual([
      {
        type: "paragraph",
        children: [
          { text: "" },
          {
            type: "link",
            url: "mailto:a@b.org",
            children: [{ text: "a@b.org" }],
          },
          { text: "" },
        ],
      },
    ]);
  });
});

describe("serialize", () => {
  it("writes an empty value as an empty string", () => {
    expect(serialize(parse(null))).toBe("");
    expect(
      serialize([
        { type: "paragraph", children: [{ text: "  " }] },
        {
          type: "list-item",
          list: "bulleted",
          depth: 0,
          children: [{ text: "" }],
        },
      ]),
    ).toBe("");
  });

  it("writes marks, links and line breaks", () => {
    const value: RichTextValue = [
      {
        type: "paragraph",
        children: [
          { text: "A " },
          { text: "bold ", bold: true },
          { text: "and italic", bold: true, italic: true },
          { text: " claim\nby " },
          {
            type: "link",
            url: "https://example.com",
            children: [{ text: "the " }, { text: "editor", italic: true }],
          },
        ],
      },
    ];

    expect(serialize(value)).toBe(
      "A **bold *and italic*** claim\\\nby [the *editor*](https://example.com)",
    );
  });

  it("writes nested lists from items of increasing depth", () => {
    const value: RichTextValue = [
      { type: "paragraph", children: [{ text: "Groceries:" }] },
      {
        type: "list-item",
        list: "bulleted",
        depth: 0,
        children: [{ text: "Fruit" }],
      },
      {
        type: "list-item",
        list: "numbered",
        depth: 1,
        children: [{ text: "Apples" }],
      },
      {
        type: "list-item",
        list: "numbered",
        depth: 1,
        children: [{ text: "Pears" }],
      },
      {
        type: "list-item",
        list: "bulleted",
        depth: 0,
        children: [{ text: "Bread" }],
      },
    ];

    expect(serialize(value)).toBe(
      "Groceries:\n\n- Fruit\n  1. Apples\n  2. Pears\n- Bread",
    );
  });

  it("takes an item that skips a level to be one level deeper", () => {
    const value: RichTextValue = [
      {
        type: "list-item",
        list: "bulleted",
        depth: 0,
        children: [{ text: "a" }],
      },
      {
        type: "list-item",
        list: "bulleted",
        depth: 2,
        children: [{ text: "b" }],
      },
    ];

    expect(serialize(value)).toBe("- a\n  - b");
  });

  it("links the bare URLs left in the text", () => {
    const value: RichTextValue = [
      {
        type: "paragraph",
        children: [{ text: "At https://example.com/a_b and www.example.org." }],
      },
    ];

    expect(serialize(value)).toBe(
      "At <https://example.com/a_b> and [www.example.org](http://www.example.org).",
    );
  });

  it("escapes text that would read as Markdown", () => {
    const value: RichTextValue = [
      {
        type: "paragraph",
        children: [{ text: "1. not a list, *not* italic, <b>" }],
      },
    ];

    expect(parse(serialize(value))).toEqual(value);
  });

  it("keeps the white space at the ends of a marked run outside the mark", () => {
    const value: RichTextValue = [
      {
        type: "paragraph",
        children: [
          { text: "a" },
          { text: " bold ", bold: true },
          { text: "b" },
        ],
      },
    ];

    expect(serialize(value)).toBe("a **bold** b");
  });
});

describe("round trips", () => {
  it.each([
    "Plain text.",
    "Two\n\nparagraphs",
    "A line\\\nbreak",
    "**Bold**, *italic* and **_both_**",
    "**bold *then italic***",
    "[A **labelled** link](https://example.com/a?b=c)",
    "<https://example.com>",
    "<a@b.org>",
    "- one\n- two\n  - nested\n    1. deeper\n- three",
    "1. first\n2. second\n\n- then bullets",
    "Before\n\n- a list\n\nAfter",
  ])("keeps %j as it is", (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("keeps marks that start or end inside a word", () => {
    const value: RichTextValue = [
      {
        type: "paragraph",
        children: [
          { text: "un", bold: true },
          { text: "for", bold: true, italic: true },
          { text: "gettable and " },
          { text: "half", italic: true },
          { text: "way" },
        ],
      },
    ];

    expect(parse(serialize(value))).toEqual(value);
  });

  it("keeps the value of what it writes", () => {
    const value = parse(
      "Intro with *style* and a [link](mailto:a@b.org).\n\n1. one\n   - sub **bold**\n2. two",
    );

    expect(parse(serialize(value))).toEqual(value);
  });
});

describe("plainText", () => {
  it("reads Markdown as one line of text", () => {
    expect(
      plainText("A **bold** [link](https://x.org).\\\nNext\n\n- item\n- other"),
    ).toBe("A bold link. Next item other");
    expect(plainText(null)).toBe("");
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

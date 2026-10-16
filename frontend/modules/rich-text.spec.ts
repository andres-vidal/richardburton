import { describe, expect, it } from "vitest";
import { EVERY_FORMAT, item, link, paragraph } from "test/rich-text-fixtures";
import {
  bareUrl,
  emptyValue,
  isBlank,
  linkBareUrls,
  linkTarget,
  plainText,
  safeUrl,
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

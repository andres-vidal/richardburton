import {
  ATTRIBUTES,
  autocomplete,
  define,
  empty,
  errorCode,
  markedValue,
  merged,
} from "./model";
import type { Publication } from "./model";
import { countriesIn } from "modules/country";
import { routing } from "i18n/routing";

// The specs are written in the default locale, so countries are named in it.
const COUNTRIES = countriesIn(routing.defaultLocale);

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
    expect(
      markedValue(
        holding({ countries: [first] }),
        "countries",
        routing.defaultLocale,
      ),
    ).toBe(COUNTRIES[first].label);
  });

  test("names every code of a list — what a merged record holds", () => {
    expect(
      markedValue(
        holding({ countries: [first, second] }),
        "countries",
        routing.defaultLocale,
      ),
    ).toBe(`${COUNTRIES[first].label}, ${COUNTRIES[second].label}`);
  });

  test("a code it has no name for is read as the code", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // One unknown code in a list does not cost the others their names.
    expect(
      markedValue(
        holding({ countries: [first, "__nope__"] }),
        "countries",
        routing.defaultLocale,
      ),
    ).toBe(`${COUNTRIES[first].label}, __nope__`);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  test("passes non-country values through untouched", () => {
    expect(
      markedValue(holding({ year: "1953" }), "year", routing.defaultLocale),
    ).toBe("1953");

    expect(
      markedValue(
        holding({ authors: ["Helen Caldwell"] }),
        "authors",
        routing.defaultLocale,
      ),
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
        routing.defaultLocale,
      ),
    ).toBe("Helen [[Caldwell]]");
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

describe("autocomplete", () => {
  test("filters countries by a case-insensitive label prefix", async () => {
    const [sample] = Object.values(COUNTRIES);
    const prefix = sample.label.slice(0, 3);

    const results = await autocomplete(prefix, "countries");

    expect(results.length).toBeGreaterThan(0);
    results.forEach((country) =>
      expect(country.label.toLowerCase()).toContain(prefix.toLowerCase()),
    );
    // Case doesn't matter — the same prefix lowercased matches the same set.
    expect((await autocomplete(prefix.toLowerCase(), "countries")).length).toBe(
      results.length,
    );
  });

  test("returns every country for an empty query", async () => {
    const results = await autocomplete("", "countries");

    expect(results).toHaveLength(Object.keys(COUNTRIES).length);
  });

  test("resolves to an empty list for attributes without suggestions", async () => {
    await expect(autocomplete("anything", "year")).resolves.toEqual([]);
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
    const winner = publication({ sources: ["Alves, 1990"] });
    const losers = [
      publication({ sources: ["Alves, 1990", "Costa, 2001"] }),
      publication({ sources: ["Dias, 2011"] }),
    ];

    expect(merged(winner, losers).sources).toEqual([
      "Alves, 1990",
      "Costa, 2001",
      "Dias, 2011",
    ]);
  });

  test("merging nothing in leaves the record as it stands", () => {
    const winner = publication({
      countries: ["GB", "US"],
      publishers: ["Bickers & Son"],
      sources: ["Alves, 1990"],
    });

    expect(merged(winner, [])).toEqual(winner);
  });
});

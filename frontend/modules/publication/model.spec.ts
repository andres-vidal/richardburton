import {
  ATTRIBUTES,
  COUNTRIES,
  autocomplete,
  define,
  describeError,
  describeValue,
  empty,
  merged,
} from "./model";
import type { Publication } from "./model";

describe("empty", () => {
  test("returns a publication with every attribute blank", () => {
    const publication = empty();

    // Every model attribute is present and empty — the shape editing relies on.
    ATTRIBUTES.forEach((key) => expect(publication[key]).toBe(""));
    // Plus a null id (no server PK yet) and an empty provenance list. References
    // are a list outside the scalar ATTRIBUTES, so they're checked separately.
    expect(publication.id).toBeNull();
    expect(publication.references).toEqual([]);
    expect(Object.keys(publication).sort()).toEqual(
      ["id", "references", ...ATTRIBUTES].sort(),
    );
  });
});

describe("describeValue", () => {
  const knownCode = Object.keys(COUNTRIES)[0];

  test("maps a country code to its label", () => {
    expect(describeValue(knownCode, "countries")).toBe(
      COUNTRIES[knownCode].label,
    );
  });

  test("maps every code of a list — what a merged record holds", () => {
    const [first, second] = Object.keys(COUNTRIES);

    expect(describeValue(`${first}, ${second}`, "countries")).toBe(
      `${COUNTRIES[first].label}, ${COUNTRIES[second].label}`,
    );
  });

  test("returns an unknown country code unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(describeValue("__nope__", "countries")).toBe("__nope__");
    expect(warn).toHaveBeenCalled();

    // One unknown code in a list does not cost the others their labels.
    expect(describeValue(`${knownCode}, __nope__`, "countries")).toBe(
      `${COUNTRIES[knownCode].label}, __nope__`,
    );

    warn.mockRestore();
  });

  test("passes non-country values through untouched", () => {
    expect(describeValue("1953", "year")).toBe("1953");
    expect(describeValue("Helen Caldwell", "authors")).toBe("Helen Caldwell");
  });
});

describe("describeError", () => {
  test("no error describes to an empty string, with or without a scope", () => {
    expect(describeError(null)).toBe("");
    expect(describeError(null, "title")).toBe("");
  });

  test("a row-level string error maps to a human message when unscoped", () => {
    expect(describeError("conflict")).toBe(
      "A publication with this data already exists",
    );
  });

  test("an unknown error code falls back to the raw code", () => {
    expect(describeError("mystery")).toBe("mystery");
  });

  test("a row-level string error is silent when asked about a field", () => {
    // String = whole-row error; it must not leak into an individual cell.
    expect(describeError("conflict", "title")).toBe("");
  });

  test("a field-error map is silent at the row level", () => {
    // Record = per-field errors; there is no single row message to show.
    expect(describeError({ title: "required" } as never)).toBe("");
  });

  test("a field-error map describes the message for the scoped field", () => {
    const errors = { title: "required", year: "integer" } as never;

    expect(describeError(errors, "title")).toBe(
      "This field is required and cannot be blank",
    );
    expect(describeError(errors, "year")).toBe(
      "This field should be an integer",
    );
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
      countries: "GB",
      publishers: "Bickers & Son",
    });
    const losers = [
      publication({ countries: "US, GB", publishers: "Noonday Press" }),
      publication({ countries: "BR", publishers: "Bickers & Son" }),
    ];

    const result = merged(winner, losers);

    expect(result.countries).toBe("BR, GB, US");
    expect(result.publishers).toBe("Bickers & Son, Noonday Press");
  });

  test("takes every source none of the others already gave", () => {
    const winner = publication({ references: ["Alves, 1990"] });
    const losers = [
      publication({ references: ["Alves, 1990", "Costa, 2001"] }),
      publication({ references: ["Dias, 2011"] }),
    ];

    expect(merged(winner, losers).references).toEqual([
      "Alves, 1990",
      "Costa, 2001",
      "Dias, 2011",
    ]);
  });

  test("merging nothing in leaves the record as it stands", () => {
    const winner = publication({
      countries: "GB, US",
      publishers: "Bickers & Son",
      references: ["Alves, 1990"],
    });

    expect(merged(winner, [])).toEqual(winner);
  });
});

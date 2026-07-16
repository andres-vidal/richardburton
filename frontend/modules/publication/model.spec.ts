import {
  ATTRIBUTES,
  COUNTRIES,
  autocomplete,
  define,
  describeError,
  describeValue,
  empty,
} from "./model";

describe("empty", () => {
  test("returns a publication with every attribute blank", () => {
    const publication = empty();

    // Every model attribute is present and empty — the shape editing relies on.
    ATTRIBUTES.forEach((key) => expect(publication[key]).toBe(""));
    // Plus a null id: an unsaved row has no server PK yet.
    expect(publication.id).toBeNull();
    expect(Object.keys(publication).sort()).toEqual(
      ["id", ...ATTRIBUTES].sort(),
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

  test("returns an unknown country code unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(describeValue("__nope__", "countries")).toBe("__nope__");
    expect(warn).toHaveBeenCalled();

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

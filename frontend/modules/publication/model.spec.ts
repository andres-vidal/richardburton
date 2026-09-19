import {
  ATTRIBUTES,
  autocomplete,
  define,
  describe as describeAttribute,
  describeValue,
  empty,
  errorCode,
  merged,
} from "./model";
import type { Publication } from "./model";
import { Country, rememberCountries } from "modules/country";
import { routing } from "i18n/routing";

vi.mock("modules/country", async (importOriginal) => ({
  ...(await importOriginal<typeof import("modules/country")>()),
  Country: { REMOTE: { search: vi.fn(), all: vi.fn() } },
}));

// The server names countries; the specs are written in the default locale, so
// they hand over the handful they name a country by.
const COUNTRIES = {
  BR: { id: "BR", label: "Brazil" },
  NL: { id: "NL", label: "Netherlands", article: "the" },
};

rememberCountries(routing.defaultLocale, Object.values(COUNTRIES));

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

describe("describeValue", () => {
  test("maps a country code to its label", () => {
    expect(describeValue("BR", "countries")).toBe("Brazil");
  });

  test("describes every code of a list — what a merged record holds", () => {
    expect(describeAttribute(["BR", "NL"], "countries")).toBe(
      "Brazil, Netherlands",
    );
  });

  test("returns an unknown country code unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(describeValue("__nope__", "countries")).toBe("__nope__");
    expect(warn).toHaveBeenCalled();

    // One unknown code in a list does not cost the others their labels.
    expect(describeAttribute(["BR", "__nope__"], "countries")).toBe(
      "Brazil, __nope__",
    );

    warn.mockRestore();
  });

  test("passes non-country values through untouched", () => {
    expect(describeValue("1953", "year")).toBe("1953");
    expect(describeValue("Helen Caldwell", "authors")).toBe("Helen Caldwell");
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
  // Which countries a term finds is the server's to decide — it is the only
  // side that knows every name a country goes by. See the Country specs.
  test("asks the server for the countries a term finds, in the reader's language", async () => {
    vi.mocked(Country.REMOTE.search).mockResolvedValue([COUNTRIES.NL]);

    await expect(autocomplete("holanda", "countries", "pt")).resolves.toEqual([
      COUNTRIES.NL,
    ]);
    expect(Country.REMOTE.search).toHaveBeenCalledWith("holanda", "pt");
  });

  test("asks in the default language when none is given", async () => {
    vi.mocked(Country.REMOTE.search).mockResolvedValue([]);

    await autocomplete("anything", "countries");

    expect(Country.REMOTE.search).toHaveBeenCalledWith(
      "anything",
      routing.defaultLocale,
    );
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

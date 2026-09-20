import {
  ATTRIBUTES,
  autocomplete,
  define,
  empty,
  errorCode,
  marking,
  merged,
} from "./model";
import type { Publication } from "./model";
import { Country } from "modules/country";
import { routing } from "i18n/routing";
import { messages } from "utils/messages";

vi.mock("modules/country", async (importOriginal) => ({
  ...(await importOriginal<typeof import("modules/country")>()),
  Country: { REMOTE: { search: vi.fn() } },
}));

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
        holding({ countries: [first], matchedCountries: [first] }),
        "countries",
      ),
    ).toBe(`[[${COUNTRIES[first]}]]`);
  });

  test("leaves the countries beside it unmarked", () => {
    expect(
      markedValue(
        holding({ countries: [first, second], matchedCountries: [second] }),
        "countries",
      ),
    ).toBe(`${COUNTRIES[first]}, [[${COUNTRIES[second]}]]`);
  });

  test("marks nothing when the search answered on another field", () => {
    expect(
      markedValue(
        holding({ countries: [first], matchedCountries: [] }),
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
        holding({ countries: [first, second], matchedCountries: [first] }),
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

describe("autocomplete", () => {
  // Which countries a term finds is the server's to decide — it is the only
  // side that knows every name a country goes by. See the Country specs.
  test("asks the server for the countries a term finds, in the reader's language", async () => {
    const netherlands = { id: "NL", label: "Países Baixos" };
    vi.mocked(Country.REMOTE.search).mockResolvedValue([netherlands]);

    await expect(autocomplete("holanda", "countries", "pt")).resolves.toEqual([
      netherlands,
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

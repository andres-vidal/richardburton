import { describe, expect, it } from "vitest";
import {
  PRESETS,
  chartParams,
  cumulative,
  descriptionParams,
  formsFor,
  groups,
  normalize,
  parseDescription,
  presetOf,
  splitsBy,
  type Description,
} from "./chart";

// A description of publications by year in columns, with `fields` changed.
const describing = (fields: Partial<Description>): Description => ({
  count: "publications",
  by: "year",
  split: null,
  form: "columns",
  first: false,
  top: null,
  least: null,
  ...fields,
});

describe("formsFor", () => {
  it("offers the forms over time for years, and bars too for decades", () => {
    expect(formsFor({ by: "year", count: "publications" })).toEqual([
      "columns",
      "lines",
      "area",
      "running",
      "shares",
    ]);
    expect(formsFor({ by: "decade", count: "publications" })).toEqual([
      "columns",
      "lines",
      "area",
      "running",
      "shares",
      "bars",
    ]);
  });

  it("offers timelines for ranked groups, and the map for publications by country only", () => {
    expect(formsFor({ by: "translator", count: "publications" })).toEqual([
      "shares",
      "bars",
      "heat",
      "timeline",
    ]);
    expect(formsFor({ by: "country", count: "publications" })).toContain("map");
    expect(formsFor({ by: "kind", count: "publications" })).toEqual([
      "shares",
      "bars",
      "heat",
    ]);
  });
});

describe("groups and splitsBy", () => {
  it("groups publications by anything", () => {
    expect(groups({ count: "publications", by: "country" })).toBe(true);
    expect(groups({ count: "publications", by: "kind" })).toBe(true);
  });

  it("groups the other counts by time and by the names listed for them", () => {
    expect(groups({ count: "works", by: "decade" })).toBe(true);
    expect(groups({ count: "works", by: "original_author" })).toBe(true);
    expect(groups({ count: "translations", by: "work" })).toBe(true);
    expect(groups({ count: "translators", by: "original_author" })).toBe(true);
    expect(groups({ count: "publishers", by: "year" })).toBe(true);
  });

  it("does not group the other counts by country, kind, or what they count", () => {
    expect(groups({ count: "translators", by: "country" })).toBe(false);
    expect(groups({ count: "works", by: "kind" })).toBe(false);
    expect(groups({ count: "works", by: "work" })).toBe(false);
    expect(groups({ count: "original_authors", by: "work" })).toBe(false);
    expect(groups({ count: "translators", by: "pair" })).toBe(false);
    expect(groups({ count: "publishers", by: "publisher" })).toBe(false);
  });

  it("splits only publications, and kinds not by kind", () => {
    expect(splitsBy({ count: "publications", by: "year" }, "country")).toBe(
      true,
    );
    expect(splitsBy({ count: "publications", by: "kind" }, "kind")).toBe(false);
    expect(splitsBy({ count: "works", by: "year" }, "kind")).toBe(false);
  });
});

describe("formsFor and the other counts", () => {
  it("offers neither the map nor shares for anything but publications", () => {
    expect(formsFor({ by: "year", count: "works" })).toEqual([
      "columns",
      "lines",
      "area",
      "running",
    ]);
    expect(formsFor({ by: "original_author", count: "works" })).toEqual([
      "bars",
      "heat",
      "timeline",
    ]);
  });
});

describe("normalize", () => {
  it("keeps a description that can be drawn as it is", () => {
    const description = describing({ by: "decade", split: "kind" });

    expect(normalize(description)).toEqual(description);
  });

  it("gives a grouping its default form when the form cannot draw it", () => {
    expect(normalize(describing({ by: "translator" })).form).toBe("bars");
    expect(normalize(describing({ by: "country" })).form).toBe("map");
    expect(normalize(describing({ by: "year", form: "map" })).form).toBe(
      "columns",
    );
  });

  it("groups by year a count that cannot be grouped as asked", () => {
    expect(
      normalize(describing({ count: "works", by: "country", form: "map" })),
    ).toEqual(describing({ count: "works", first: true }));
    expect(
      normalize(
        describing({
          count: "original_authors",
          by: "original_author",
          form: "bars",
        }),
      ),
    ).toEqual(describing({ count: "original_authors", first: true }));
  });

  it("drops a split the count cannot take", () => {
    expect(
      normalize(describing({ count: "translators", split: "country" })).split,
    ).toBeNull();
  });

  it("does not draw shares without a split", () => {
    expect(normalize(describing({ form: "shares" })).form).toBe("columns");
  });

  it("drops the split of a form that draws no series", () => {
    expect(
      normalize(
        describing({ by: "translator", split: "kind", form: "timeline" }),
      ).split,
    ).toBeNull();
  });

  it("counts first appearances for every count but publications that is placed in time", () => {
    expect(normalize(describing({ count: "works" })).first).toBe(true);
    expect(
      normalize(
        describing({ count: "works", by: "original_author", form: "heat" }),
      ).first,
    ).toBe(true);
    expect(
      normalize(
        describing({
          count: "works",
          by: "original_author",
          form: "bars",
          first: true,
        }),
      ).first,
    ).toBe(false);
    expect(normalize(describing({ form: "running", first: true })).first).toBe(
      false,
    );
  });

  it("drops top and least on a map, which shows every country", () => {
    expect(
      normalize(describing({ by: "country", form: "map", top: 10, least: 2 })),
    ).toMatchObject({ top: null, least: null });
  });

  it("drops top and least for groups that are not ranked", () => {
    expect(normalize(describing({ top: 10, least: 2 }))).toMatchObject({
      top: null,
      least: null,
    });
    expect(
      normalize(describing({ by: "work", form: "bars", top: 10, least: 2 })),
    ).toMatchObject({ top: 10, least: 2 });
  });
});

describe("parseDescription", () => {
  it("is the first preset when the address describes no chart", () => {
    expect(parseDescription({})).toEqual(PRESETS[0].description);
    expect(parseDescription({ search: "machado" })).toEqual(
      PRESETS[0].description,
    );
  });

  it("reads what descriptionParams writes", () => {
    for (const { description } of PRESETS) {
      expect(parseDescription(descriptionParams(description))).toEqual(
        description,
      );
    }
  });

  it("reads a value that is not one of a parameter's values as missing", () => {
    expect(
      parseDescription({ count: "readers", by: "translator", top: "7" }),
    ).toEqual(describing({ by: "translator", form: "bars" }));
  });

  it("normalizes what it reads", () => {
    expect(parseDescription({ by: "decade", form: "map", top: "10" })).toEqual(
      describing({ by: "decade" }),
    );
  });
});

describe("descriptionParams", () => {
  it("writes the fields that are set, and leaves out the others", () => {
    expect(descriptionParams(describing({}))).toEqual({
      count: "publications",
      by: "year",
      form: "columns",
    });
    expect(
      descriptionParams(
        describing({ by: "work", form: "timeline", first: true, top: 10 }),
      ),
    ).toEqual({
      count: "publications",
      by: "work",
      form: "timeline",
      first: "true",
      top: "10",
    });
  });
});

describe("chartParams", () => {
  it("asks for steps of a year for a timeline, and of a decade for a heat table", () => {
    expect(
      chartParams(describing({ by: "translator", form: "timeline" })),
    ).toEqual({
      count: "publications",
      by: "translator",
      over: "year",
    });
    expect(chartParams(describing({ by: "translator", form: "heat" }))).toEqual(
      {
        count: "publications",
        by: "translator",
        over: "decade",
      },
    );
  });

  it("leaves out the form, which the backend does not take", () => {
    expect(
      chartParams(
        describing({
          count: "works",
          split: "kind",
          form: "running",
          first: true,
        }),
      ),
    ).toEqual({ count: "works", by: "year", split: "kind", first: true });
  });
});

describe("presetOf", () => {
  it("finds the preset a description is, and none for any other", () => {
    expect(presetOf(PRESETS[3].description)?.name).toBe("debuts");
    expect(presetOf(describing({ form: "lines" }))).toBeUndefined();
  });
});

describe("cumulative", () => {
  it("adds each row's counts to the rows before it", () => {
    expect(
      cumulative([
        { at: 1950, counts: [2, 0] },
        { at: 1960, counts: [0, 1] },
        { at: 1970, counts: [2, 1] },
      ]),
    ).toEqual([
      { at: 1950, counts: [2, 0] },
      { at: 1960, counts: [2, 1] },
      { at: 1970, counts: [4, 2] },
    ]);
  });
});

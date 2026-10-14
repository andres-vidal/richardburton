/**
 * The description of a chart on the insights page, how it is written in the
 * page's address, and how it is sent to `GET /insights`.
 *
 * A chart counts **items**, named by `count`, in **groups**, named by `by`. It
 * can split each group into **series**, named by `split`, and it is drawn in a
 * **form**, such as columns or a map. The backend's
 * `RichardBurton.Publication.Chart` defines each count, grouping and split.
 *
 * A form decides part of what is asked for: a timeline counts each group in
 * steps of a year, and a heat table in steps of a decade.
 *
 * A year, a decade, a country and a kind belong to a publication. So
 * publications take every grouping, split and form, while the other counts
 * are grouped only by the names `GROUPINGS_OF` lists for them, take no split,
 * and are placed in time only at their **first appearance**: the year of
 * their earliest publication (see `countsFirst`). `normalize` keeps a
 * description to these combinations, and to the ones the forms can draw.
 */

const COUNTS = [
  "publications",
  "works",
  "translations",
  "original_authors",
  "translators",
  "publishers",
] as const;

const GROUPINGS = [
  "year",
  "decade",
  "kind",
  "country",
  "original_author",
  "translator",
  "publisher",
  "work",
  "pair",
] as const;

const SPLITS = ["kind", "country"] as const;

const FORMS = [
  "columns",
  "lines",
  "area",
  "running",
  "shares",
  "bars",
  "heat",
  "timeline",
  "map",
] as const;

/** The values `top` can take besides `null`, which keeps every group. */
const TOPS = [10, 20, 50] as const;

/** The values `least` can take besides `null`, which keeps groups of any size. */
const LEASTS = [2, 3, 5, 10] as const;

type Count = (typeof COUNTS)[number];
type Grouping = (typeof GROUPINGS)[number];
type Split = (typeof SPLITS)[number];
type Form = (typeof FORMS)[number];

/** A chart, as the insights page's address describes it. */
type Description = {
  count: Count;
  by: Grouping;
  /** The series, or null for one series. */
  split: Split | null;
  form: Form;
  /** How many ranked groups to keep, or null to keep them all. */
  top: number | null;
  /** The fewest items a ranked group needs, or null for any number. */
  least: number | null;
};

/** The parameters of `GET /insights` that describe the chart. */
type ChartParams = {
  count: Count;
  by: Grouping;
  split?: Split;
  over?: "year" | "decade";
  first?: true;
  top?: number;
  least?: number;
};

/**
 * Returns whether `by` groups by time, so the groups are years or decades in
 * order rather than ranked.
 */
const isTime = (by: Grouping) => by === "year" || by === "decade";

/**
 * Returns whether the groups of `by` are ranked by their counts, so `top` and
 * `least` apply to them.
 */
const isRanked = (by: Grouping) => !isTime(by) && by !== "kind";

/**
 * Returns whether a description keeps only some of its groups with `top` and
 * `least`: its groups are ranked, and it is not a map, which shows every
 * country.
 */
const isCut = ({ by, form }: Pick<Description, "by" | "form">) =>
  isRanked(by) && form !== "map";

/** The grouping and the count a form is chosen for. */
type Subject = Pick<Description, "by" | "count">;

/**
 * Returns whether `form` can draw groups of `by` counting `count`. A map
 * shades each country by its publications, so it draws only publications by
 * country, and shares need a split, which only publications take.
 */
function fits(form: Form, { by, count }: Subject): boolean {
  switch (form) {
    case "columns":
    case "lines":
    case "area":
    case "running":
      return isTime(by);
    case "bars":
      return by !== "year";
    case "heat":
      return !isTime(by);
    case "timeline":
      return isRanked(by);
    case "map":
      return by === "country" && count === "publications";
    case "shares":
      return count === "publications";
  }
}

/** Returns whether `form` draws series. Forms in steps of time do not. */
const splits = (form: Form) =>
  form !== "heat" && form !== "timeline" && form !== "map";

/**
 * Returns the forms that can draw groups of `by` counting `count`, in the
 * order of `FORMS`.
 */
const formsFor = (subject: Subject) =>
  FORMS.filter((form) => fits(form, subject));

/**
 * Returns the form a grouping and a count are drawn in when the chosen one
 * does not fit: columns over time, the map for publications by country, and
 * bars otherwise.
 */
const defaultForm = (subject: Subject): Form =>
  isTime(subject.by) ? "columns" : fits("map", subject) ? "map" : "bars";

/** Returns the step of time `form` counts each group in, if any. */
const overOf = (form: Form) =>
  form === "timeline" ? "year" : form === "heat" ? "decade" : undefined;

/**
 * Returns whether a description counts each item at its first appearance only:
 * it counts something other than publications, and places it in time by its
 * groups or by a form that counts each group in steps of time.
 */
const countsFirst = ({
  count,
  by,
  form,
}: Pick<Description, "count" | "by" | "form">) =>
  count !== "publications" && (isTime(by) || overOf(form) !== undefined);

/**
 * The groupings each count other than publications is grouped by: a year or a
 * decade, at the item's first appearance, and the names that say something
 * about the item, such as the original authors of works or the works of
 * translations.
 */
const GROUPINGS_OF: Record<Exclude<Count, "publications">, Grouping[]> = {
  works: ["year", "decade", "original_author", "translator", "publisher"],
  translations: ["year", "decade", "work", "original_author", "translator"],
  original_authors: ["year", "decade", "translator", "publisher"],
  translators: ["year", "decade", "original_author", "work"],
  publishers: ["year", "decade"],
};

/**
 * Returns whether `count` can be grouped by `by`: publications by anything,
 * and the other counts by what `GROUPINGS_OF` lists for them.
 */
const groups = ({ count, by }: Subject) =>
  count === "publications" || GROUPINGS_OF[count].includes(by);

/**
 * Returns whether groups of `by` counting `count` can be split by `split`.
 * Only publications are split, and kinds are not split by kind.
 */
const splitsBy = ({ count, by }: Subject, split: Split) =>
  count === "publications" && (split === "country" || by !== "kind");

/**
 * Returns `description` changed only as much as it takes to be drawn:
 *
 * - A grouping its count cannot be grouped by (see `groups`) becomes groups by
 *   year, and a split the count and grouping cannot take (see `splitsBy`) is
 *   dropped.
 * - A form that cannot draw the grouping and the count becomes their default
 *   form, and shares without a split become the default form too.
 * - A form that draws no series drops the split.
 * - A description that keeps all its groups drops `top` and `least` (see
 *   `isCut`).
 */
function normalize(description: Description): Description {
  const { count } = description;
  const by = groups(description) ? description.by : "year";
  const split =
    description.split && splitsBy({ count, by }, description.split)
      ? description.split
      : null;
  const chosen = fits(description.form, { count, by })
    ? description.form
    : defaultForm({ count, by });
  const form =
    chosen === "shares" && !split ? defaultForm({ count, by }) : chosen;

  return {
    count,
    by,
    split: splits(form) ? split : null,
    form,
    top: isCut({ by, form }) ? description.top : null,
    least: isCut({ by, form }) ? description.least : null,
  };
}

/**
 * The presets, each named by its key in the `insights` messages, where its
 * title and its hint are. They are the charts the insights page opens with,
 * and the first is the one it shows when the address describes none.
 */
const PRESETS = [
  {
    name: "perYear",
    description: {
      count: "publications",
      by: "year",
      split: "country",
      form: "columns",
    },
  },
  {
    name: "byDecade",
    description: {
      count: "publications",
      by: "decade",
      split: "kind",
      form: "bars",
    },
  },
  {
    name: "leadingAuthors",
    description: {
      count: "publications",
      by: "original_author",
      form: "bars",
      top: 10,
    },
  },
  {
    name: "debuts",
    description: {
      count: "original_authors",
      by: "decade",
      form: "bars",
    },
  },
  {
    name: "leadingTranslators",
    description: {
      count: "publications",
      by: "translator",
      form: "timeline",
      top: 10,
    },
  },
  {
    name: "pairs",
    description: { count: "publications", by: "pair", form: "bars", top: 10 },
  },
  {
    name: "retranslated",
    description: {
      count: "translations",
      by: "work",
      form: "timeline",
      top: 10,
      least: 2,
    },
  },
  {
    name: "leadingPublishers",
    description: {
      count: "publications",
      by: "publisher",
      form: "bars",
      top: 10,
    },
  },
  {
    name: "countriesOfPublication",
    description: { count: "publications", by: "country", form: "map" },
  },
].map(({ name, description }) => ({
  name,
  description: {
    split: null,
    top: null,
    least: null,
    ...description,
  } as Description,
}));

type Preset = (typeof PRESETS)[number];

/** Returns the preset `description` is, if it is one. */
const presetOf = (description: Description): Preset | undefined =>
  PRESETS.find(({ description: preset }) =>
    (Object.keys(preset) as (keyof Description)[]).every(
      (field) => preset[field] === description[field],
    ),
  );

/** The query parameters of the insights page that describe the chart. */
const PARAMS = ["count", "by", "split", "form", "top", "least"] as const;

/** Returns `value` when it is one of `values`, and undefined otherwise. */
function oneOf<T extends string | number>(
  values: readonly T[],
  value: string | undefined,
): T | undefined {
  return values.find((each) => String(each) === value);
}

/**
 * Reads a description from the insights page's query parameters. Without any
 * of `PARAMS`, it is the first preset. A parameter with a value that is not
 * one of its values is read as missing. Missing parameters take the defaults:
 * publications by year, in the grouping's default form.
 */
function parseDescription(
  params: Partial<Record<string, string | string[]>>,
): Description {
  const read = (name: string) => {
    const value = params[name];
    return Array.isArray(value) ? value[0] : value;
  };

  if (PARAMS.every((name) => read(name) === undefined)) {
    return PRESETS[0].description;
  }

  const by = oneOf(GROUPINGS, read("by")) ?? "year";
  const count = oneOf(COUNTS, read("count")) ?? "publications";

  return normalize({
    count,
    by,
    split: oneOf(SPLITS, read("split")) ?? null,
    form: oneOf(FORMS, read("form")) ?? defaultForm({ by, count }),
    top: oneOf(TOPS, read("top")) ?? null,
    least: oneOf(LEASTS, read("least")) ?? null,
  });
}

/**
 * Returns the query parameters that describe `description`, leaving out a
 * split, `top` and `least` when they are not set.
 */
function descriptionParams(description: Description): Record<string, string> {
  const { count, by, split, form, top, least } = description;

  return {
    count,
    by,
    ...(split ? { split } : {}),
    form,
    ...(top ? { top: String(top) } : {}),
    ...(least ? { least: String(least) } : {}),
  };
}

/** Returns the parameters of `GET /insights` that ask for `description`. */
function chartParams(description: Description): ChartParams {
  const { count, by, split, form, top, least } = description;
  const over = overOf(form);
  const first = countsFirst(description);

  return {
    count,
    by,
    ...(split ? { split } : {}),
    ...(over ? { over } : {}),
    ...(first ? { first: true as const } : {}),
    ...(top ? { top } : {}),
    ...(least ? { least } : {}),
  };
}

/**
 * Returns the running total of each series over `rows`, in order: each row's
 * counts are added to the counts of the rows before it.
 */
function cumulative<Row extends { counts: number[] }>(rows: Row[]): Row[] {
  return rows.reduce<Row[]>((running, row) => {
    const before = running[running.length - 1];

    return [
      ...running,
      before
        ? {
            ...row,
            counts: row.counts.map(
              (count, index) => count + before.counts[index],
            ),
          }
        : row,
    ];
  }, []);
}

export {
  COUNTS,
  GROUPINGS,
  LEASTS,
  PRESETS,
  SPLITS,
  TOPS,
  chartParams,
  countsFirst,
  cumulative,
  descriptionParams,
  formsFor,
  groups,
  isCut,
  isTime,
  normalize,
  oneOf,
  parseDescription,
  presetOf,
  splits,
  splitsBy,
};
export type { ChartParams, Description, Form, Preset, Split };

import type { CountryNaming } from "modules/country-names";

/** A publication as the API sends and takes it, one field per attribute. */
type Publication = {
  title: string;
  countries: string[];
  year: string;
  publishers: string[];
  authors: string[];
  originalTitle: string;
  originalAuthors: string[];
  sources: string[];
  /**
   * The publication's comments in Markdown (see `modules/comments`), or null
   * when it has none. A page of the index leaves comments out, so a record read
   * from one has no `comments` key, and neither has a new row nobody has
   * commented on. A request without the key keeps the stored comments, and a
   * null clears them.
   */
  comments?: string | null;
  /**
   * The stored publication's id, or null for a row that is not stored. The
   * server never takes it from a request body.
   */
  id: number | null;
  /**
   * The matching text of each field, with the matched words wrapped in
   * `[[ ]]`, or null for a field the search did not match. Only search results
   * carry it, and never for `countries` or `year`.
   */
  excerpts?: Partial<Record<PublicationKey | "sources", string | null>>;
  /**
   * What a search matched, value by value: for each list field, a list lined up
   * with the field's values that holds each value's matching text, or null
   * where that value did not match. Only a record read with a search carries
   * it, and `sources` only where the whole list of sources is shown.
   *
   * `countries` holds the matched country's code rather than marked text,
   * since naming a country needs a locale the index does not have.
   */
  marked?: Partial<Record<PublicationListKey | "sources", (string | null)[]>>;
};

/**
 * The name of an attribute: a field of a publication other than its id, its
 * sources, its comments and its search marks.
 */
type PublicationKey = keyof Omit<
  Publication,
  "id" | "sources" | "comments" | "excerpts" | "marked"
>;

/**
 * One word the search matched with something other than what was typed.
 *
 * Holds the word as typed, the indexed words it actually matched, and the field
 * it was searched in. The field is `null` for a free word, which is searched in
 * every field.
 *
 * Words matched exactly are not included, so this is empty for most searches.
 * `field` is the name used to write an operator, so every entry can be read back
 * as a search term.
 */
type Matched = {
  field: string | null;
  /** The word exactly as the reader typed it. */
  typed: string;
  /** The indexed words it matched, when those were not simply the word itself. */
  words: string[];
};

/** What an attribute holds: one value, or several. */
type PublicationValue = Publication[PublicationKey];

/** The attributes that hold several values, for readers that need all of them. */
type PublicationListKey = {
  [K in PublicationKey]: Publication[K] extends string[] ? K : never;
}[PublicationKey];

/**
 * What is wrong with a row: null when nothing is, the code of an error with the
 * whole row, or the code of an error with each field that has one, the
 * comments included.
 */
type PublicationError =
  null | string | (Record<PublicationKey, string> & { comments?: string });

/** A field that can have an error of its own: an attribute or the comments. */
type ErrorScope = PublicationKey | "comments";

/**
 * What the look-alike check found for a row: the stored records it resembles,
 * the other rows it resembles, and `repeats`, the first earlier row with the
 * same composite key, or null when there is none.
 */
type Resemblance = {
  stored: Publication[];
  others: PublicationId[];
  repeats: PublicationId | null;
};

/** A publication and what validation found wrong with it. */
type ValidationResult = { publication: Publication; errors: PublicationError };

/** A validation result for the row with the key `id`. */
type PublicationEntry = ValidationResult & { id: PublicationId };

/**
 * The key the store uses for a row.
 *
 * A row the server has saved is keyed by its publication id, a number. A row
 * being worked on in a workspace is keyed by a UUID created in the browser.
 * UUIDs are unique across browsers, so two people editing the same row use the
 * same key for it. The draft row has the fixed key `DRAFT_ID`.
 *
 * A number never equals a string, so one store can hold both kinds of row. Use
 * `Publication["id"]` rather than this type where a saved record is meant,
 * since an endpoint for a stored publication takes a publication id, not a row
 * key.
 */
type PublicationId = number | string;

/** The kind of input an attribute is edited with. */
type PublicationKeyType = "array" | "text" | "enumArray" | "number" | "book";
/** Every act the log records, in the order a reader meets them. */
const HISTORY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "restored",
  "merged",
  "unmerged",
  "renamed",
  "distinguished",
  "reconsidered",
] as const;

/** An act the log records. */
type PublicationHistoryAction = (typeof HISTORY_ACTIONS)[number];

/**
 * What an entry of the log changed: the old and new value of each field that
 * changed, the comments included, and the sources added, removed or
 * reordered, or null when the sources did not change.
 */
type SnapshotDiff = {
  fields: Partial<
    Record<PublicationKey, { from: unknown; to: unknown }> & {
      comments: { from: string | null; to: string | null };
    }
  >;
  sources: { added: string[]; removed: string[]; reordered: boolean } | null;
};

/**
 * A publication as the log keeps it: the record's own fields, without the
 * surrogate id, and with the year as the number it is stored as.
 */
type PublicationSnapshot = Omit<Publication, "id" | "year"> & { year: number };

/**
 * A publication an entry of the log names besides its own, as it stood when
 * the entry was recorded. Identified, unlike a snapshot: an entry names several
 * of these at once, and two records that were merged may well share a title.
 */
type OtherPublication = PublicationSnapshot & { id: number };

/**
 * One entry of a publication's log: the act, who did it and when, the record as
 * it stood afterwards, what changed, and whether the act can be undone.
 */
type PublicationHistoryEntry = {
  version: number;
  action: PublicationHistoryAction;
  actor: string;
  timestamp: string;
  snapshot: PublicationSnapshot;
  diff: SnapshotDiff | null;
  undoable: boolean;
  /**
   * The other publications this entry is about. The action says how: a merge
   * took them in (`merged`), an un-merge gave them back (`unmerged`), or a
   * duplicate reviewer's decision ruled them not to be the same record
   * (`distinguished`) or put them back among the possible duplicates
   * (`reconsidered`). Empty or absent on entries of any other action.
   */
  others?: OtherPublication[] | null;
};

/** An entry of the log of the whole database, with its publication's id. */
type FullHistoryEntry = PublicationHistoryEntry & { publicationId: number };

/** A publication that is deleted now, and when it was deleted. */
type DeletedPublicationEntry = { publication: Publication; deletedAt: string };

/** Every attribute, in the order the columns are shown. */
const ATTRIBUTES: PublicationKey[] = [
  "title",
  "originalTitle",
  "authors",
  "originalAuthors",
  "year",
  "countries",
  "publishers",
];

/** The kind of input each attribute is edited with. */
const ATTRIBUTE_TYPES: Record<PublicationKey, PublicationKeyType> = {
  authors: "array",
  originalAuthors: "array",
  originalTitle: "book",
  countries: "enumArray",
  publishers: "array",
  title: "text",
  year: "number",
};

/** Whether each attribute's column can be hidden. */
const ATTRIBUTE_IS_TOGGLEABLE: Record<PublicationKey, boolean> = {
  authors: true,
  originalAuthors: true,
  originalTitle: false,
  countries: true,
  publishers: true,
  title: false,
  year: true,
};

/** Whether each attribute's column is shown before anyone changes it. */
const DEFAULT_ATTRIBUTE_VISIBILITY: Record<PublicationKey, boolean> = {
  title: true,
  countries: true,
  year: true,
  publishers: true,
  authors: true,
  originalTitle: true,
  originalAuthors: true,
};

/**
 * Returns a publication with no id, an empty text in each text field and an
 * empty list in each list field. It has no `comments` key, which saves as no
 * comments.
 */
function empty(): Publication {
  return {
    id: null,
    authors: [],
    countries: [],
    originalAuthors: [],
    originalTitle: "",
    publishers: [],
    title: "",
    year: "",
    sources: [],
  };
}

/**
 * Converts a row key written as text back into a `PublicationId`.
 *
 * Text made only of digits is a server id and becomes a number. Any other text
 * is returned unchanged. The store compares keys with `===`, so a server id
 * must come back as a number.
 */
function idFromText(text: string): PublicationId {
  return /^\d+$/.test(text) ? Number(text) : text;
}

/**
 * What one record would look like with others folded into it: the survivor's
 * own fields, the countries and publishers of all of them, every source none
 * of the others already gave, and the survivor's comments followed by each
 * other record's comments, as further paragraphs. Comments that are empty, or
 * that repeat earlier ones, are left out. When no record has any, the result
 * has the survivor's. A record read from a page of the index has no comments
 * to add.
 *
 * The server merges the records itself and decides the result. This function
 * repeats its rules, so the result can be shown before the merge is asked for.
 */
function merged(winner: Publication, losers: Publication[]): Publication {
  const all = [winner, ...losers];

  const union = (attribute: "countries" | "publishers") =>
    Array.from(new Set(all.flatMap((p) => p[attribute]))).sort();

  const comments = Array.from(
    new Set(all.map((p) => p.comments?.trim() ?? "").filter(Boolean)),
  );

  return {
    ...winner,
    countries: union("countries"),
    publishers: union("publishers"),
    sources: Array.from(new Set(all.flatMap((p) => p.sources))),
    comments: comments.length > 0 ? comments.join("\n\n") : winner.comments,
  };
}

/** A field `contrast` compares: any attribute, or the sources. */
type ContrastedKey = PublicationKey | "sources";

/** A run of a value's text, and whether it differs from the other records. */
type Stretch = { text: string; differs: boolean };

/** One field of a record, compared with the same field of other records. */
type Contrast = {
  /** Each value the field holds, as the stretches its text splits into. */
  values: Stretch[][];
  /** True when the field is empty and at least one other record fills it. */
  lacking: boolean;
};

/**
 * The fields compared value by value. Every other field is compared word by
 * word.
 *
 * A year or a country code has no words to tell apart, and a source is a
 * citation that is either given or not.
 */
const WHOLE_VALUES: ContrastedKey[] = ["year", "countries", "sources"];

/**
 * Compares one field of `publication` with the same field of `others`, and
 * returns the field's values split into stretches that do or do not differ.
 *
 * A word differs when at least one of the other records lacks it anywhere in
 * that field. The comparison is exact, so a change of case or accent counts.
 * Consecutive words that differ form one stretch together with the spaces
 * between them. In the fields listed in `WHOLE_VALUES`, each value is one
 * stretch, and it differs when at least one of the other records lacks that
 * value.
 *
 * With no other records, nothing differs.
 */
function contrast(
  publication: Publication,
  others: Publication[],
  attribute: ContrastedKey,
): Contrast {
  const whole = WHOLE_VALUES.includes(attribute);
  const units = (values: string[]) =>
    new Set(whole ? values : values.flatMap((value) => value.split(/\s+/)));

  const own = valuesOf(publication, attribute);
  const theirs = others.map((other) => valuesOf(other, attribute));
  const held = theirs.map(units);
  const differs = (unit: string) => held.some((units) => !units.has(unit));

  return {
    values: own.map((value) =>
      whole
        ? [{ text: value, differs: differs(value) }]
        : stretches(value, differs),
    ),
    lacking: own.length === 0 && theirs.some((values) => values.length > 0),
  };
}

// Returns a field's values as trimmed text, leaving out empty ones. A year can
// arrive as a number, so every value is converted to text.
function valuesOf(
  publication: Publication,
  attribute: ContrastedKey,
): string[] {
  const value = publication[attribute];

  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item ?? "").trim())
    .filter((item) => item !== "");
}

// Splits `value` into stretches of words that do or do not differ. A space
// differs only when the words on both sides of it do, so a stretch that differs
// starts and ends with a word.
function stretches(
  value: string,
  differs: (word: string) => boolean,
): Stretch[] {
  // Words sit at even indices and the spaces between them at odd ones.
  const tokens = value.split(/(\s+)/);
  const flags = tokens.map((token, index) =>
    index % 2 === 0
      ? differs(token)
      : differs(tokens[index - 1]) && differs(tokens[index + 1]),
  );

  return tokens.reduce<Stretch[]>((result, text, index) => {
    const last = result[result.length - 1];

    return last?.differs === flags[index]
      ? [
          ...result.slice(0, -1),
          { text: last.text + text, differs: last.differs },
        ]
      : [...result, { text, differs: flags[index] }];
  }, []);
}

/**
 * An attribute's values as a reader sees them: each value's marked text where
 * the search matched it, and the value itself where it did not.
 *
 * Takes unknowns rather than strings because the wire does not always agree
 * with the model. `year` is an integer on the backend and text in a form, so it
 * arrives here as either.
 *
 * Countries are stored as codes and read as names, and `marked.countries` holds
 * a code rather than marked text. So a country that matched has its whole name
 * wrapped here, because the word that matched is often not in the name shown:
 * "Holanda" matches a name neither language shows.
 */
function shown(
  values: unknown[],
  attribute: PublicationKey,
  country: CountryNaming,
  marked?: Publication["marked"],
): string[] {
  const per = marked?.[attribute as PublicationListKey];

  if (attribute !== "countries") {
    return values.map((value, index) => per?.[index] ?? String(value ?? ""));
  }

  return values.map((value, index) => {
    const name = country.name(String(value ?? ""));

    return per?.[index] ? `[[${name}]]` : name;
  });
}

/**
 * A field as the index marked it, or as it is stored when the search did not
 * match it. The marks are the index's own, so what a reader is shown as the
 * answer is what was actually searched.
 */
function markedValue(
  publication: Publication,
  attribute: PublicationKey,
  locale: string,
  country: CountryNaming,
): string {
  const excerpt = publication.excerpts?.[attribute];
  if (excerpt) return excerpt;

  const value = publication[attribute];
  const values = shown(
    Array.isArray(value) ? value : [value],
    attribute,
    country,
    publication.marked,
  );

  return Array.isArray(value)
    ? new Intl.ListFormat(locale, { style: "long", type: "unit" }).format(
        values,
      )
    : values[0];
}

/**
 * Each value a field holds, paired with that value as the index marked it. The
 * value is what a term would search for, the label what is shown.
 *
 * The index marks each value separately, so a value carrying a comma is no
 * trouble. A value the search did not match reads as it is stored.
 *
 * Countries are the exception: `marked.countries` holds a code rather than
 * marked text, so `shown` is what wraps their names.
 */
function markedItems(
  publication: Publication,
  attribute: PublicationKey,
  locale: string,
  country: CountryNaming,
): { value: string; label: string }[] {
  const values = (publication[attribute] ?? []) as string[];
  const labels = shown(values, attribute, country, publication.marked);

  return values.map((value, index) => ({ value, label: labels[index] }));
}

/** How a publication's fields read to one reader. See `marking`. */
type Marking = {
  /** A whole field, its values joined as that reader's language joins a list. */
  value(publication: Publication, attribute: PublicationKey): string;
  /** Each of a field's values on its own, paired with how it reads. */
  items(
    publication: Publication,
    attribute: PublicationKey,
  ): { value: string; label: string }[];
};

/**
 * How a publication reads to one reader: their language, and how they name a
 * country.
 *
 * The functions it returns take only a publication and an attribute, so the
 * locale and the country naming are passed once, and code outside React can
 * use them too.
 */
function marking(locale: string, country: CountryNaming): Marking {
  return {
    value: (publication, attribute) =>
      markedValue(publication, attribute, locale, country),
    items: (publication, attribute) =>
      markedItems(publication, attribute, locale, country),
  };
}

/**
 * Each of a publication's sources as the index marked it, or as it is stored
 * where the search did not match that one.
 */
function markedSources(publication: Publication): string[] {
  const sources = publication.sources ?? [];
  const marked = publication.marked?.sources;

  return sources.map((source, index) => marked?.[index] ?? source);
}

/**
 * Returns the code of what is wrong, or an empty string when nothing is.
 *
 * Without `scope`, it returns the code of an error with the whole row. With
 * `scope`, it returns the code of the error with that field. A row has one kind
 * of error or the other, so asking for the kind it does not have returns an
 * empty string.
 *
 * The sentence for each code is in the `publicationError` messages. This module
 * runs outside React, where there is no locale to write a sentence in.
 */
function errorCode(error: PublicationError, scope?: ErrorScope): string {
  if (!error) {
    return "";
  } else if (!scope) {
    return typeof error === "string" ? error : "";
  } else {
    return typeof error === "string" ? "" : (error[scope] ?? "");
  }
}

/**
 * Returns the bounds an attribute's input takes: for the year, from 0 to the
 * current year. Other attributes have none.
 */
function define(attribute: PublicationKey): Record<string, unknown> {
  if (attribute === "year") {
    return { min: 0, max: new Date().getFullYear() };
  }
  return {};
}

/**
 * Returns a link to `path` that searches the publications for `term`. The link
 * carries `params` first and `term` as the `search` parameter after them, all
 * URL-encoded. It is `path` alone when there is no term and no other parameter.
 * An empty `path` gives only the query string, which a link resolves against
 * the current page.
 */
function searchHref(
  term: string | null | undefined,
  path = "/",
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams(params);
  if (term) query.set("search", term);

  const string = query.toString();
  return string ? `${path}?${string}` : path;
}

/**
 * The constants and helpers of the model, read as `Publication.X`. The value
 * shares its name with the `Publication` type.
 */
const Publication = {
  ATTRIBUTES,
  ATTRIBUTE_TYPES,
  ATTRIBUTE_IS_TOGGLEABLE,
  define,
  errorCode,
  marking,
  markedSources,
  empty,
  merged,
};

export {
  ATTRIBUTES,
  contrast,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  define,
  errorCode,
  empty,
  HISTORY_ACTIONS,
  idFromText,
  marking,
  merged,
  Publication,
  searchHref,
};
export type {
  Contrast,
  ErrorScope,
  ContrastedKey,
  DeletedPublicationEntry,
  PublicationValue,
  FullHistoryEntry,
  PublicationEntry,
  PublicationError,
  PublicationHistoryAction,
  PublicationHistoryEntry,
  PublicationId,
  Marking,
  Matched,
  PublicationKey,
  PublicationKeyType,
  PublicationListKey,
  Resemblance,
  SnapshotDiff,
  ValidationResult,
};

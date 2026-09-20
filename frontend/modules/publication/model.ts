import { isString } from "lodash";
import { Author } from "modules/author";
import { Country } from "modules/country";
import type { CountryNaming } from "modules/country-names";
import { routing } from "i18n/routing";
import { OriginalBook, type OriginalBookValue } from "modules/original-book";
import { Publisher } from "modules/publisher";

type Publication = {
  title: string;
  countries: string[];
  year: string;
  publishers: string[];
  authors: string[];
  originalTitle: string;
  originalAuthors: string[];
  sources: string[];
  // The server PK: a real id on persisted rows (index/search), null on
  // unsaved/working rows. Read-only: never cast from client input.
  id: number | null;
  // The matching text of each field, keyed by field, with the matched words
  // wrapped in `[[ ]]`. Only present on search results, and null for any field
  // the search did not match. `countries` and `year` never carry one.
  excerpts?: Partial<Record<PublicationKey | "sources", string | null>>;
  // What matched, value by value: a list lined up with the field's own, holding
  // each value's matching text and null where that value did not match. Only
  // present on a record read with a search, and `sources` only where the whole
  // provenance list is shown.
  //
  // `countries` holds the matched country's code rather than marked text, since
  // naming a country needs a locale the index does not have.
  marked?: Partial<Record<PublicationListKey | "sources", (string | null)[]>>;
};

type PublicationKey = keyof Omit<
  Publication,
  "id" | "sources" | "excerpts" | "marked"
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

type PublicationError = null | string | Record<PublicationKey, string>;
type ValidationResult = { publication: Publication; errors: PublicationError };
type PublicationEntry = ValidationResult & { id: number };
type PublicationId = NonNullable<Publication["id"]>;
type PublicationKeyType =
  "array" | "text" | "enum" | "enumArray" | "number" | "book";
/** Every act the log records, in the order a reader meets them. */
const HISTORY_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "restored",
  "merged",
  "unmerged",
] as const;

type PublicationHistoryAction = (typeof HISTORY_ACTIONS)[number];

type SnapshotDiff = {
  fields: Partial<Record<PublicationKey, { from: unknown; to: unknown }>>;
  sources: { added: string[]; removed: string[]; reordered: boolean } | null;
};

/**
 * A publication as the log keeps it: the record's own fields, without the
 * surrogate id, and with the year as the number it is stored as.
 */
type PublicationSnapshot = Omit<Publication, "id" | "year"> & { year: number };

/**
 * A publication a merge took in, or an un-merge gave back. Identified, unlike
 * a snapshot: an entry names several of these at once, and two records that
 * were merged may well share a title.
 */
type AbsorbedPublication = PublicationSnapshot & { id: number };

type PublicationHistoryEntry = {
  version: number;
  action: PublicationHistoryAction;
  actor: string;
  timestamp: string;
  snapshot: PublicationSnapshot;
  diff: SnapshotDiff | null;
  undoable: boolean;
  /**
   * The publications this entry took in (a merge) or gave back (an un-merge) —
   * a merge is one act over several records, and this is what says which.
   * Absent on entries that change one record only.
   */
  absorbed?: AbsorbedPublication[] | null;
};

// The database-wide feed tags each entry with the publication it belongs to.
type FullHistoryEntry = PublicationHistoryEntry & { publicationId: number };

// A publication that is *currently* deleted — the trash's state, distinct from
// the history's record of deletion events.
type DeletedPublicationEntry = { publication: Publication; deletedAt: string };

const ATTRIBUTES: PublicationKey[] = [
  "title",
  "originalTitle",
  "authors",
  "originalAuthors",
  "year",
  "countries",
  "publishers",
];

const ATTRIBUTE_TYPES: Record<PublicationKey, PublicationKeyType> = {
  authors: "array",
  originalAuthors: "array",
  originalTitle: "book",
  countries: "enumArray",
  publishers: "array",
  title: "text",
  year: "number",
};

const ATTRIBUTE_IS_TOGGLEABLE: Record<PublicationKey, boolean> = {
  authors: true,
  originalAuthors: true,
  originalTitle: false,
  countries: true,
  publishers: true,
  title: false,
  year: true,
};

const DEFAULT_ATTRIBUTE_VISIBILITY: Record<PublicationKey, boolean> = {
  title: true,
  countries: true,
  year: true,
  publishers: true,
  authors: true,
  originalTitle: true,
  originalAuthors: true,
};

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
 * What one record would look like with others folded into it: the survivor's
 * own fields, the countries and publishers of all of them, and every source
 * none of the others already gave.
 *
 * A preview, so an admin sees the outcome before asking for it. The server
 * reconciles a merge itself and stays the authority on what it produces; the
 * rules are simple enough to say twice, and saying them here is what lets the
 * dialog show the result rather than describe it.
 */
function merged(winner: Publication, losers: Publication[]): Publication {
  const all = [winner, ...losers];

  const union = (attribute: "countries" | "publishers") =>
    Array.from(new Set(all.flatMap((p) => p[attribute]))).sort();

  return {
    ...winner,
    countries: union("countries"),
    publishers: union("publishers"),
    sources: Array.from(new Set(all.flatMap((p) => p.sources))),
  };
}

/**
 * An attribute's values as a reader should see them: country codes become
 * country names, and anything else is its own text. Countries are the only
 * attribute a publication stores as something other than what is read.
 *
 * Takes unknowns rather than strings because the wire does not always agree
 * with the model. `year` is an integer on the backend and text in a form, so it
 * arrives here as either.
 *
 * A country listed in `matched` gets its whole name wrapped in the index's own
 * `[[ ]]`. The whole name, because what matched is often not what is displayed:
 * "Holanda" matches a name neither language shows. The index decides which
 * countries matched; nothing here works that out.
 */
function shown(
  values: unknown[],
  attribute: PublicationKey,
  country: CountryNaming,
  matched?: string[],
): string[] {
  const text = values.map((value) => String(value ?? ""));

  if (attribute !== "countries") return text;

  return text.map((code) => {
    const name = country.name(code);

    return matched?.includes(code) ? `[[${name}]]` : name;
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
    matchedCountries(publication),
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
  const read = shown(values, attribute, country, matchedCountries(publication));

  const marked =
    attribute === "countries"
      ? undefined
      : publication.marked?.[attribute as PublicationListKey];

  return values.map((value, index) => ({
    value,
    label: marked?.[index] ?? read[index],
  }));
}

/** How a publication's fields read to one reader — see `marking`. */
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
 * Both belong to the reader, not the record. Taking them once keeps the
 * language out of every call, and lets code outside React say who is reading.
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

/** The codes of the countries the search matched, dropping the ones it did not. */
function matchedCountries(publication: Publication): string[] {
  return (publication.marked?.countries ?? []).filter(
    (code): code is string => code !== null,
  );
}

/**
 * The code for what is wrong, empty where nothing is.
 *
 * A code, not a sentence: this module is read outside React, with no locale to
 * write one in. The sentence lives in the `publicationError` catalogue under
 * this code.
 *
 * Unscoped answers the publication's own error, scoped the field's. A
 * publication has one kind or the other, so asking for the absent kind is empty
 * rather than wrong.
 */
function errorCode(error: PublicationError, scope?: PublicationKey): string {
  if (!error) {
    return "";
  } else if (!scope) {
    return isString(error) ? error : "";
  } else {
    return isString(error) ? "" : error[scope];
  }
}

function define(attribute: PublicationKey): Record<string, unknown> {
  if (attribute === "year") {
    return { min: 0, max: new Date().getFullYear() };
  }
  return {};
}

function autocomplete(
  value: string,
  attribute: "countries",
  locale?: string,
): Promise<Country[]>;
function autocomplete(
  value: string,
  attribute: "originalAuthors",
): Promise<Author[]>;
function autocomplete(value: string, attribute: "authors"): Promise<Author[]>;
function autocomplete(
  value: string,
  attribute: "originalTitle",
): Promise<OriginalBookValue[]>;
function autocomplete(value: string, attribute: "publishers"): Promise<[]>;
function autocomplete(
  value: string,
  attribute: string,
  locale?: string,
): Promise<[]>;
function autocomplete(
  value: string,
  attribute: string,
  locale?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  switch (attribute) {
    case "authors":
    case "originalAuthors":
      return Author.REMOTE.search(value);
    case "publishers":
      return Publisher.REMOTE.search(value);

    // The original book is one entity, so it is suggested as one: a term finds
    // it by its title or by an author, and the suggestion carries both.
    case "originalTitle":
      return OriginalBook.REMOTE.search(value);

    case "countries":
      return Country.REMOTE.search(value, locale ?? routing.defaultLocale);
    default:
      return new Promise<[]>((resolve) => resolve([]));
  }
}

// Model namespace — constants + pure helpers. Same `Publication.X` shape the
// components already use (a type and a value can share the name in TS).
const Publication = {
  ATTRIBUTES,
  ATTRIBUTE_TYPES,
  ATTRIBUTE_IS_TOGGLEABLE,
  autocomplete,
  define,
  errorCode,
  marking,
  markedSources,
  empty,
  merged,
};

export {
  ATTRIBUTE_IS_TOGGLEABLE,
  ATTRIBUTE_TYPES,
  ATTRIBUTES,
  autocomplete,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  define,
  errorCode,
  empty,
  HISTORY_ACTIONS,
  marking,
  merged,
  Publication,
};
export type {
  AbsorbedPublication,
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
  SnapshotDiff,
  ValidationResult,
};

import { isString } from "lodash";
import { Author } from "modules/author";
import { COUNTRIES, Country } from "modules/country";
import { OriginalBook, type OriginalBookValue } from "modules/original-book";
import { Publisher } from "modules/publisher";

type Publication = {
  title: string;
  countries: string;
  year: string;
  publishers: string;
  authors: string;
  originalTitle: string;
  originalAuthors: string;
  sources: string[];
  // The server PK: a real id on persisted rows (index/search), null on
  // unsaved/working rows. Read-only: never cast from client input.
  id: number | null;
  // A snippet of the sources that answered a search, when they are what did.
  // Present only on search results, and only for the rows the sources answered.
  sourceMatch?: string;
};

type PublicationKey = keyof Omit<Publication, "id" | "sources" | "sourceMatch">;

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

const ATTRIBUTE_LABELS: Record<PublicationKey, string> = {
  authors: "Translators",
  originalAuthors: "Original Authors",
  originalTitle: "Original Title",
  countries: "Countries",
  publishers: "Publishers",
  title: "Title",
  year: "Year",
};

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

const ERROR_MESSAGES: Record<string, string> = {
  conflict: `A publication with this data already exists`,
  required: `This field is required and cannot be blank`,
  integer: `This field should be an integer`,
  incorrect_row_length: `Expected a different number of columns in csv`,
  invalid_format: `Could not parse publications from the provided file`,
  invalid_escape_sequence: `Could not parse publications from the provided file`,
  stray_escape_character: `Could not parse publications from the provided file`,
  alpha2: `This field should be a valid ISO 3166-1 alpha 2 country code`,
  duplicate: `This field cannot repeat the same entry`,
};

function empty(): Publication {
  return {
    id: null,
    authors: "",
    countries: "",
    originalAuthors: "",
    originalTitle: "",
    publishers: "",
    title: "",
    year: "",
    sources: [],
  };
}

/**
 * The individual values behind a multi-valued attribute. Countries, publishers
 * and the like are held as one comma-joined string; this is the one place that
 * knows it, so every reader of them counts and compares the same things.
 */
function items(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    Array.from(new Set(all.flatMap((p) => items(p[attribute]))))
      .sort()
      .join(", ");

  return {
    ...winner,
    countries: union("countries"),
    publishers: union("publishers"),
    sources: Array.from(new Set(all.flatMap((p) => p.sources))),
  };
}

function describeValue(value: string, attribute: PublicationKey): string {
  if (attribute === "countries") {
    // One code or a list of them: a record published in several places names
    // them all in the one field.
    return value
      .split(",")
      .map((code) => {
        const country = COUNTRIES[code.trim()];
        if (country) return country.label;
        console.warn("Unknown country code: ", code.trim());
        return code.trim();
      })
      .join(", ");
  }
  return value;
}

function describeError(
  error: PublicationError,
  scope?: PublicationKey,
): string {
  if (!error) {
    return "";
  } else if (!scope) {
    if (isString(error)) {
      return ERROR_MESSAGES[error] || error;
    } else {
      return "";
    }
  } else {
    if (isString(error)) {
      return "";
    } else {
      return ERROR_MESSAGES[error[scope]] || error[scope];
    }
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
function autocomplete(value: string, attribute: string): Promise<[]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autocomplete(value: string, attribute: string): Promise<any> {
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

    case "countries": {
      const all = Object.values(COUNTRIES);
      const countries = value
        ? Object.values(COUNTRIES).filter((opt) =>
            opt.label.toLowerCase().startsWith(value.toLowerCase()),
          )
        : all;

      return new Promise<Country[]>((resolve) => resolve(countries));
    }
    default:
      return new Promise<[]>((resolve) => resolve([]));
  }
}

// Model namespace — constants + pure helpers. Same `Publication.X` shape the
// components already use (a type and a value can share the name in TS).
const Publication = {
  ATTRIBUTES,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_TYPES,
  ATTRIBUTE_IS_TOGGLEABLE,
  autocomplete,
  define,
  describeError,
  describeValue,
  empty,
  items,
  merged,
};

export {
  ATTRIBUTE_IS_TOGGLEABLE,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_TYPES,
  ATTRIBUTES,
  autocomplete,
  COUNTRIES,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  define,
  describeError,
  describeValue,
  empty,
  HISTORY_ACTIONS,
  items,
  merged,
  Publication,
};
export type {
  AbsorbedPublication,
  DeletedPublicationEntry,
  FullHistoryEntry,
  PublicationEntry,
  PublicationError,
  PublicationHistoryAction,
  PublicationHistoryEntry,
  PublicationId,
  PublicationKey,
  PublicationKeyType,
  SnapshotDiff,
  ValidationResult,
};

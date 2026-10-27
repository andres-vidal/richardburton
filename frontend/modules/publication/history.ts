import { sortBy, uniq } from "lodash";
import { isBlank, type RichTextValue } from "modules/rich-text";
import type {
  FullHistoryEntry,
  Language,
  NameField,
  PublicationHistoryEntry,
  SnapshotDiff,
  Source,
} from "./model";
import {
  LANGUAGES,
  NOTES_KEYS,
  type PublicationKey,
  Publication,
} from "./model";

/** A field whose value changed, with the old and the new value as text. */
type FieldChange = {
  kind: "field";
  attribute: PublicationKey;
  from: string;
  to: string;
};

/** The sources added and removed, and whether the rest were reordered. */
type SourcesChange = {
  kind: "sources";
  added: Source[];
  removed: Source[];
  reordered: boolean;
};

/**
 * The notes in `language` before and after the change, each a rich-text
 * value, or null where there were none.
 */
type NotesChange = {
  kind: "notes";
  language: Language;
  from: RichTextValue | null;
  to: RichTextValue | null;
};

/** One record a merge took in, or an un-merge gave back, in full. */
type AbsorbedRecord = {
  /** The record's id, since two records a merge took in can share a title. */
  id: number;
  title: string;
  fields: { attribute: PublicationKey; value: string }[];
  sources: Source[];
  /** The record's notes in each language that it had notes in. */
  notes: { language: Language; value: RichTextValue }[];
};

/**
 * The records a merge took in (`in`), or an un-merge gave back (`back`), each
 * with every field it held. The entry's diff covers only the record that
 * remains, so these hold what the other records held.
 */
type AbsorbedChange = {
  kind: "absorbed";
  direction: "in" | "back";
  records: AbsorbedRecord[];
};

/**
 * The other publications a duplicate reviewer's decision is about, each named
 * by its title, year and translators. `apart` is a decision that they are not
 * the same record, and `again` one that puts them back among the possible
 * duplicates.
 */
type RelatedChange = {
  kind: "related";
  direction: "apart" | "again";
  records: { id: number; title: string; year: number; authors: string }[];
};

/**
 * The role of a renamed name in the publications it is credited on: the
 * publisher, the translator or the original author. A person renamed in more
 * than one role is a `name`.
 */
type NameRole = "publisher" | "translator" | "originalAuthor" | "name";

/** A publication a rename changed, named by its title and year. */
type RenamedPublication = { id: number; title: string; year: number };

/**
 * A name changed in names management: its role, the name before (`from`) and
 * the name after (`to`), and the publications the rename changed, sorted by
 * title and year. `to` is null when the name was folded into a name that the
 * publications already credit, since the rename then added no name to them.
 *
 * `others` are the publications the rename changed besides the entry's own.
 * `publications` are all of them, the entry's own included when the entry
 * carries its publication's id.
 */
type RenameChange = {
  kind: "rename";
  role: NameRole;
  from: string;
  to: string | null;
  others: RenamedPublication[];
  publications: RenamedPublication[];
};

/** One change an entry of the log made. */
type Change =
  | FieldChange
  | SourcesChange
  | NotesChange
  | AbsorbedChange
  | RelatedChange
  | RenameChange;

/** An entry with the changes its act made. */
type WithChanges<T> = T & { changes: Change[] };

/** Returns a key that identifies an entry within the log of the database. */
function keyOf(entry: FullHistoryEntry): string {
  return `${entry.publicationId}:${entry.version}`;
}

/**
 * Returns the changes in the server's `diff`: one `FieldChange` for each field
 * that changed, in the order of `ATTRIBUTES`, with its values as text, then a
 * `SourcesChange` when the sources changed, and a `NotesChange` for each
 * language whose notes changed, Portuguese first. Returns an empty list for a
 * null diff.
 */
function presentChanges(diff: SnapshotDiff | null): Change[] {
  if (diff === null) return [];

  const fields: Change[] = Publication.ATTRIBUTES.filter(
    (key) => diff.fields[key] !== undefined,
  ).map((key) => ({
    kind: "field",
    attribute: key,
    from: String(diff.fields[key]!.from),
    to: String(diff.fields[key]!.to),
  }));
  const notes: Change[] = LANGUAGES.flatMap((language) => {
    const change = diff.fields[NOTES_KEYS[language]];

    return change === undefined
      ? []
      : [
          {
            kind: "notes" as const,
            language,
            from: change.from ?? null,
            to: change.to ?? null,
          },
        ];
  });

  return [
    ...fields,
    ...(diff.sources === null
      ? []
      : [{ kind: "sources" as const, ...diff.sources }]),
    ...notes,
  ];
}

/**
 * Returns the records a merge took in, or an un-merge gave back, as one
 * `AbsorbedChange`, each record with its title, every other field that has a
 * value, its sources and its notes in each language it had notes in. The
 * records are the entry's `others`.
 * Returns an empty list for an entry of any other action, or one that names no
 * records.
 */
function presentAbsorbed(entry: PublicationHistoryEntry): Change[] {
  const absorbed =
    entry.action === "merged" || entry.action === "unmerged"
      ? (entry.others ?? [])
      : [];
  if (absorbed.length === 0) return [];

  const records = absorbed.map((publication) => ({
    id: publication.id,
    title: publication.title,
    fields: Publication.ATTRIBUTES.filter((key) => key !== "title")
      .map((key) => ({
        attribute: key,
        value: String(publication[key] ?? ""),
      }))
      .filter(({ value }) => value !== ""),
    sources: publication.sources ?? [],
    notes: LANGUAGES.flatMap((language) => {
      const value = publication[NOTES_KEYS[language]];

      return isBlank(value) ? [] : [{ language, value: value! }];
    }),
  }));

  return [
    {
      kind: "absorbed",
      direction: entry.action === "merged" ? "in" : "back",
      records,
    },
  ];
}

/**
 * Returns the other publications a duplicate decision is about as one
 * `RelatedChange`, each named by its title, year and translators. The
 * publications are the entry's `others`. Returns an empty list for an entry
 * that is not a decision, or one that names no other publications.
 */
function presentRelated(entry: PublicationHistoryEntry): Change[] {
  const related =
    entry.action === "distinguished" || entry.action === "reconsidered"
      ? (entry.others ?? [])
      : [];

  return related.length === 0
    ? []
    : [
        {
          kind: "related",
          direction: entry.action === "distinguished" ? "apart" : "again",
          records: related.map(({ id, title, year, authors }) => ({
            id,
            title,
            year,
            authors: authors.join(", "),
          })),
        },
      ];
}

/** The role a name has in each field that holds names. */
const ROLES: Record<NameField, Exclude<NameRole, "name">> = {
  publishers: "publisher",
  authors: "translator",
  originalAuthors: "originalAuthor",
};

/** Returns `publications` sorted by title, then year, then id. */
function byTitle(publications: RenamedPublication[]): RenamedPublication[] {
  return sortBy(publications, ["title", "year", "id"]);
}

/**
 * Returns the name change of a rename's entry as one `RenameChange`. The role
 * comes from the fields the name changed in, and the names before and after
 * are every name the rename removed and added, joined with commas. The other
 * publications are the entry's `others`, and `publications` adds the entry's
 * own publication when the entry carries its id.
 *
 * Returns an empty list for an entry that is not a rename's, and for a rename
 * whose name change is null or removed no name.
 */
function presentRename(
  entry: PublicationHistoryEntry & { publicationId?: number },
): Change[] {
  const changed = (Object.keys(ROLES) as NameField[]).flatMap((field) => {
    const change = entry.nameChange?.[field];
    return change === undefined ? [] : [{ field, ...change }];
  });
  const from = uniq(changed.flatMap((change) => change.from));
  const to = uniq(changed.flatMap((change) => change.to));
  const others = (entry.others ?? []).map(({ id, title, year }) => ({
    id,
    title,
    year,
  }));
  const own =
    entry.publicationId === undefined
      ? []
      : [
          {
            id: entry.publicationId,
            title: entry.snapshot.title,
            year: entry.snapshot.year,
          },
        ];

  return entry.action !== "renamed" || from.length === 0
    ? []
    : [
        {
          kind: "rename",
          role: changed.length === 1 ? ROLES[changed[0].field] : "name",
          from: from.join(", "),
          to: to.length === 0 ? null : to.join(", "),
          others: byTitle(others),
          publications: byTitle([...own, ...others]),
        },
      ];
}

/**
 * Returns the changes of one entry. A rename with a name change has only its
 * `RenameChange`, which already says what changed in the names. Any other
 * entry has the changes of its diff, then the records a merge took in or gave
 * back, then the publications a decision is about.
 */
function changesOf(
  entry: PublicationHistoryEntry & { publicationId?: number },
): Change[] {
  const rename = presentRename(entry);

  return rename.length > 0
    ? rename
    : [
        ...presentChanges(entry.diff),
        ...presentAbsorbed(entry),
        ...presentRelated(entry),
      ];
}

/**
 * Returns each entry with its changes (see `changesOf`). It is meant to run
 * once, where the log is read, so no component computes the changes while it
 * renders.
 */
function withChanges<T extends PublicationHistoryEntry>(
  entries: T[],
): WithChanges<T>[] {
  return entries.map((entry) => ({ ...entry, changes: changesOf(entry) }));
}

export {
  keyOf,
  presentAbsorbed,
  presentChanges,
  presentRelated,
  presentRename,
  withChanges,
};
export type { NameRole, RenameChange, WithChanges };

import type {
  FullHistoryEntry,
  PublicationHistoryEntry,
  SnapshotDiff,
} from "./model";
import { type PublicationKey, Publication } from "./model";

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
  added: string[];
  removed: string[];
  reordered: boolean;
};

/** One record a merge took in, or an un-merge gave back, in full. */
type AbsorbedRecord = {
  /** The record's id, since two records a merge took in can share a title. */
  id: number;
  title: string;
  fields: { attribute: PublicationKey; value: string }[];
  sources: string[];
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

/** One change an entry of the log made. */
type Change = FieldChange | SourcesChange | AbsorbedChange | RelatedChange;

/** An entry with the changes its act made. */
type WithChanges<T> = T & { changes: Change[] };

/** Returns a key that identifies an entry within the log of the database. */
function keyOf(entry: FullHistoryEntry): string {
  return `${entry.publicationId}:${entry.version}`;
}

/**
 * Returns the changes in the server's `diff`: one `FieldChange` for each field
 * that changed, in the order of `ATTRIBUTES`, with its values as text, and then
 * a `SourcesChange` when the sources changed. Returns an empty list for a null
 * diff.
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

  return diff.sources === null
    ? fields
    : [...fields, { kind: "sources", ...diff.sources }];
}

/**
 * Returns the records an entry took in or gave back as one `AbsorbedChange`,
 * each record with its title, every other field that has a value, and its
 * sources. Returns an empty list for an entry that took in no records.
 */
function presentAbsorbed(entry: PublicationHistoryEntry): Change[] {
  const absorbed = entry.absorbed ?? [];
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
 * `RelatedChange`, each named by its title, year and translators. Returns an
 * empty list for an entry that names no other publications.
 */
function presentRelated(entry: PublicationHistoryEntry): Change[] {
  const related = entry.related ?? [];

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

/**
 * Returns each entry with its changes. It is meant to run once, where the log
 * is read, so no component computes the changes while it renders.
 */
function withChanges<T extends PublicationHistoryEntry>(
  entries: T[],
): WithChanges<T>[] {
  return entries.map((entry) => ({
    ...entry,
    changes: [
      ...presentChanges(entry.diff),
      ...presentAbsorbed(entry),
      ...presentRelated(entry),
    ],
  }));
}

export { keyOf, presentAbsorbed, presentChanges, presentRelated, withChanges };
export type { WithChanges };

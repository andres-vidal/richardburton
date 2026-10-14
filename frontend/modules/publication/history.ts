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

/**
 * The comments before and after the change, each in Markdown, or null where
 * there were none.
 */
type CommentsChange = {
  kind: "comments";
  from: string | null;
  to: string | null;
};

/** One record a merge took in, or an un-merge gave back, in full. */
type AbsorbedRecord = {
  /** The record's id, since two records a merge took in can share a title. */
  id: number;
  title: string;
  fields: { attribute: PublicationKey; value: string }[];
  sources: string[];
  /** The record's comments in Markdown, or null when it had none. */
  comments: string | null;
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
type Change =
  FieldChange | SourcesChange | CommentsChange | AbsorbedChange | RelatedChange;

/** An entry with the changes its act made. */
type WithChanges<T> = T & { changes: Change[] };

/** Returns a key that identifies an entry within the log of the database. */
function keyOf(entry: FullHistoryEntry): string {
  return `${entry.publicationId}:${entry.version}`;
}

/**
 * Returns the changes in the server's `diff`: one `FieldChange` for each field
 * that changed, in the order of `ATTRIBUTES`, with its values as text, then a
 * `SourcesChange` when the sources changed, and a `CommentsChange` when the
 * comments changed. Returns an empty list for a null diff.
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
  const comments = diff.fields.comments;

  return [
    ...fields,
    ...(diff.sources === null
      ? []
      : [{ kind: "sources" as const, ...diff.sources }]),
    ...(comments === undefined
      ? []
      : [
          {
            kind: "comments" as const,
            from: comments.from ?? null,
            to: comments.to ?? null,
          },
        ]),
  ];
}

/**
 * Returns the records a merge took in, or an un-merge gave back, as one
 * `AbsorbedChange`, each record with its title, every other field that has a
 * value, its sources and its comments. The records are the entry's `others`.
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
    comments: publication.comments ?? null,
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

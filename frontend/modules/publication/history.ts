import type {
  FullHistoryEntry,
  PublicationHistoryEntry,
  SnapshotDiff,
} from "./model";
import { Publication } from "./model";

type FieldChange = {
  kind: "field";
  label: string;
  from: string;
  to: string;
};

type SourcesChange = {
  kind: "sources";
  added: string[];
  removed: string[];
  reordered: boolean;
};

/** One record a merge took in, or an un-merge gave back, in full. */
type AbsorbedRecord = {
  /** The record's own id — two records a merge took in may well share a title. */
  id: number;
  title: string;
  fields: { label: string; value: string }[];
  sources: string[];
};

/**
 * The records that changed hands. A merge is one act over several
 * publications, and the entry's diff can only speak for the one that survived
 * it — this is the other side: everything the records that left were holding,
 * which is what a reader needs to judge what the merge did to the data.
 */
type AbsorbedChange = {
  kind: "absorbed";
  direction: "in" | "back";
  records: AbsorbedRecord[];
};

type Change = FieldChange | SourcesChange | AbsorbedChange;

/** An entry carrying the changes its action made — what the views render. */
type WithChanges<T> = T & { changes: Change[] };

/** Stable identity of an entry within the log. */
function keyOf(entry: FullHistoryEntry): string {
  return `${entry.publicationId}:${entry.version}`;
}

/**
 * Turn the server's structural diff into something renderable: field keys
 * become labels, raw values become strings, and the whole thing takes the
 * database's own attribute order rather than whatever order the payload
 * happened to arrive in. Sources come last, as the one change that is a list
 * rather than a value.
 *
 * This is the seam the wire format buys us — the server says *what* changed, and
 * every decision about how it reads is made here, once, on the way in.
 */
function presentChanges(diff: SnapshotDiff | null): Change[] {
  if (diff === null) return [];

  const fields: Change[] = Publication.ATTRIBUTES.filter(
    (key) => diff.fields[key] !== undefined,
  ).map((key) => ({
    kind: "field",
    label: Publication.ATTRIBUTE_LABELS[key],
    from: String(diff.fields[key]!.from),
    to: String(diff.fields[key]!.to),
  }));

  return diff.sources === null
    ? fields
    : [...fields, { kind: "sources", ...diff.sources }];
}

/**
 * The records an entry took in or gave back, spelled out in full.
 *
 * A merge's own diff says what the surviving record gained; it cannot say what
 * the records that left were holding, and they are no longer anywhere to be
 * looked up. So the entry carries them, and this renders each one whole — every
 * field it had, and its sources — so the log answers what happened to the data
 * rather than only what happened to the survivor.
 */
function presentAbsorbed(entry: PublicationHistoryEntry): Change[] {
  const absorbed = entry.absorbed ?? [];
  if (absorbed.length === 0) return [];

  const records = absorbed.map((publication) => ({
    id: publication.id,
    title: publication.title || "an untitled record",
    fields: Publication.ATTRIBUTES.filter((key) => key !== "title")
      .map((key) => ({
        label: Publication.ATTRIBUTE_LABELS[key],
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
 * Each entry paired with its rendered changes — resolved once, when the log is
 * fetched, so no view recomputes a diff while painting.
 */
function withChanges<T extends PublicationHistoryEntry>(
  entries: T[],
): WithChanges<T>[] {
  return entries.map((entry) => ({
    ...entry,
    changes: [...presentChanges(entry.diff), ...presentAbsorbed(entry)],
  }));
}

export { keyOf, presentAbsorbed, presentChanges, withChanges };
export type { Change, WithChanges };

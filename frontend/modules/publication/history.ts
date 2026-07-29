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

type ReferencesChange = {
  kind: "references";
  added: string[];
  removed: string[];
  reordered: boolean;
};

type Change = FieldChange | ReferencesChange;

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
 * happened to arrive in. References come last, as the one change that is a list
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

  return diff.references === null
    ? fields
    : [...fields, { kind: "references", ...diff.references }];
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
    changes: presentChanges(entry.diff),
  }));
}

export { keyOf, presentChanges, withChanges };
export type { Change, WithChanges };

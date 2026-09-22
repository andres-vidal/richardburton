import * as Y from "yjs";

import { empty, type Publication, type PublicationId } from "./model";

/**
 * A bulk-import workspace's content as a Yjs document.
 *
 * The document holds two things. `rows` is a map of row key to the row's
 * fields, which is what lets an edit name the row it belongs to without knowing
 * where the row sits. `order` is the list of those keys in reading order, which
 * a map cannot express.
 *
 * A field of a row is a plain value, so two people writing the same field
 * resolve to one of the two — the right answer for a title, where merging the
 * two character by character would produce one neither person typed. `sources`
 * is the exception: it is a `Y.Array`, so two people adding a source each keep
 * both, where one value would drop one of them.
 *
 * Only content lives here. Selection, focus, column visibility and validation
 * errors stay in local state: someone else hiding a column should not move your
 * screen.
 */
type Rows = Y.Map<Y.Map<unknown>>;
type Order = Y.Array<string>;

/**
 * The origin stamped on a transaction this client makes.
 *
 * It is what separates a change someone made here from one that arrived from
 * elsewhere, which is what lets undo walk back a person's own edits and leave
 * their collaborator's alone.
 */
const LOCAL = Symbol("local");

/** The fields a row keeps as a list that merges rather than replaces. */
const MERGED = ["sources"] as const;

type MergedKey = (typeof MERGED)[number];

const isMerged = (key: string): key is MergedKey =>
  (MERGED as readonly string[]).includes(key);

function rows(doc: Y.Doc): Rows {
  return doc.getMap("rows");
}

function order(doc: Y.Doc): Order {
  return doc.getArray("order");
}

/** Every change this client makes, stamped so undo and the relay can tell. */
function write<T>(doc: Y.Doc, change: () => T): T {
  return doc.transact(change, LOCAL);
}

/** A row's fields as the document holds them. */
function rowOf(publication: Publication): Y.Map<unknown> {
  const row = new Y.Map<unknown>();

  Object.entries(publication).forEach(([key, value]) => {
    row.set(key, isMerged(key) ? asArray(value as string[]) : value);
  });

  return row;
}

function asArray(values: string[]): Y.Array<string> {
  const array = new Y.Array<string>();
  array.push(values);

  return array;
}

/** A row read back out, in the shape the rest of the application speaks. */
function publicationOf(row: Y.Map<unknown>): Publication {
  const publication = { ...empty() } as Record<string, unknown>;

  row.forEach((value, key) => {
    publication[key] = value instanceof Y.Array ? value.toArray() : value;
  });

  return publication as Publication;
}

/** The keys the document holds, in reading order. */
function keys(doc: Y.Doc): PublicationId[] {
  return order(doc).toArray();
}

/** Replace the whole working set, which is what an upload does. */
function setAll(
  doc: Y.Doc,
  entries: { id: PublicationId; publication: Publication }[],
): void {
  write(doc, () => {
    rows(doc).clear();
    order(doc).delete(0, order(doc).length);

    entries.forEach(({ id, publication }) =>
      rows(doc).set(String(id), rowOf(publication)),
    );
    order(doc).push(entries.map(({ id }) => String(id)));
  });
}

/** Add one row at the end. */
function addRow(doc: Y.Doc, id: PublicationId, publication: Publication): void {
  write(doc, () => {
    rows(doc).set(String(id), rowOf(publication));
    order(doc).push([String(id)]);
  });
}

/** Add one row immediately after another, which is what duplicating does. */
function addRowAfter(
  doc: Y.Doc,
  after: PublicationId,
  id: PublicationId,
  publication: Publication,
): void {
  write(doc, () => {
    rows(doc).set(String(id), rowOf(publication));

    const at = order(doc).toArray().indexOf(String(after));
    order(doc).insert(at < 0 ? order(doc).length : at + 1, [String(id)]);
  });
}

function removeRow(doc: Y.Doc, id: PublicationId): void {
  write(doc, () => {
    rows(doc).delete(String(id));

    const at = order(doc).toArray().indexOf(String(id));
    if (at >= 0) order(doc).delete(at, 1);
  });
}

/** One field of one row. */
function setField(
  doc: Y.Doc,
  id: PublicationId,
  attribute: string,
  value: unknown,
): void {
  const row = rows(doc).get(String(id));
  if (!row) return;

  write(doc, () => row.set(attribute, value));
}

/**
 * A row's provenance list, written as the smallest edit that produces it.
 *
 * Replacing the array wholesale would lose a source added elsewhere at the same
 * moment, which is the one thing holding sources in a `Y.Array` is for. The
 * common edits — appending one, removing one, changing one in place — are
 * applied as themselves instead.
 */
function setSources(doc: Y.Doc, id: PublicationId, sources: string[]): void {
  const row = rows(doc).get(String(id));
  if (!row) return;

  const held = row.get("sources");
  if (!(held instanceof Y.Array)) return;

  write(doc, () => {
    const current = held.toArray();

    // Trailing additions and removals are the whole of what the editor does
    // most of the time, and applying them as themselves leaves the rest of the
    // list untouched for anyone editing it at the same moment.
    const common = sharedPrefix(current, sources);

    if (common < current.length) held.delete(common, current.length - common);
    if (common < sources.length) held.push(sources.slice(common));
  });
}

function sharedPrefix(before: string[], after: string[]): number {
  const limit = Math.min(before.length, after.length);

  let at = 0;
  while (at < limit && before[at] === after[at]) at += 1;

  return at;
}

/**
 * Call `onRows` with the keys whose content changed, and `onOrder` when the
 * reading order does.
 *
 * Yjs applies a local change and fires this synchronously, so a keystroke is
 * still readable in the tick it was typed in. Nothing here writes back to the
 * document, so there is no echo to guard against.
 */
function observe(
  doc: Y.Doc,
  handlers: {
    onRows: (changed: PublicationId[]) => void;
    onOrder: () => void;
  },
): () => void {
  const onRows = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
    const changed = new Set<string>();

    events.forEach((event) => {
      // A change to the map itself names the rows it added or removed; a change
      // inside a row names the row by where the event sits in the tree.
      if (event.target === rows(doc)) {
        event.changes.keys.forEach((_change, key) => changed.add(key));
      } else {
        const [key] = event.path;
        if (typeof key === "string") changed.add(key);
      }
    });

    handlers.onRows([...changed]);
  };

  const onOrder = () => handlers.onOrder();

  rows(doc).observeDeep(onRows);
  order(doc).observe(onOrder);

  return () => {
    rows(doc).unobserveDeep(onRows);
    order(doc).unobserve(onOrder);
  };
}

/** Whether the document holds this row at all. */
function holds(doc: Y.Doc, id: PublicationId): boolean {
  return rows(doc).has(String(id));
}

/** The row, or null where the document does not hold it. */
function readRow(doc: Y.Doc, id: PublicationId): Publication | null {
  const row = rows(doc).get(String(id));

  return row ? publicationOf(row) : null;
}

/**
 * Undo scoped to this client's own edits.
 *
 * Tracking only the local origin is what makes it personal: walking back your
 * last change must not walk back what the person beside you just typed.
 *
 * Edits close together in time become one step, so a burst of typing is undone
 * as the word it was. Adding a row is not an edit to it, though, and the caller
 * marks that boundary with `stopCapturing` — otherwise one undo of a row typed
 * into straight away would take the row away rather than the typing.
 */
function undoManager(doc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager([rows(doc), order(doc)], {
    trackedOrigins: new Set([LOCAL]),
  });
}

export {
  LOCAL,
  addRow,
  addRowAfter,
  holds,
  keys,
  observe,
  publicationOf,
  readRow,
  removeRow,
  setAll,
  setField,
  setSources,
  undoManager,
  write,
};
export type { Order, Rows };

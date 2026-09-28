import * as Y from "yjs";

import {
  empty,
  idFromText,
  type Publication,
  type PublicationId,
} from "./model";

/**
 * A publication store's rows as a Yjs document.
 *
 * Every store keeps its rows in one. The store of an import document works in
 * the document everyone with it open shares. Any other store keeps a document
 * of its own, holding the rows it read from the database and the edits made to
 * them.
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

/**
 * Whether a change was made by the person at this screen.
 *
 * Their edits carry `LOCAL`. Walking one back, or forward again, carries the
 * undo manager that did it instead, because Yjs stamps an undo with the manager
 * rather than with the origin of what it reverses. Both are theirs, so both have
 * to be saved and passed to the others; asking for `LOCAL` alone is how an undo
 * would happen on one screen and nowhere else.
 */
const isLocal = (origin: unknown): boolean =>
  origin === LOCAL || origin instanceof Y.UndoManager;

/**
 * The origin stamped on rows put in the document as the database holds them.
 *
 * Holding what is already saved is not an edit, so undo does not track it and
 * `isLocal` does not count it.
 */
const SAVED = Symbol("saved");

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

/**
 * Make `change` as the database's rather than as an edit.
 *
 * Everything inside carries `SAVED`, including changes made by the functions
 * here that stamp their own origin, because a transaction already running keeps
 * the origin it was opened with.
 */
function hold(doc: Y.Doc, change: () => void): void {
  doc.transact(change, SAVED);
}

/** A row's fields as the document holds them. */
function rowOf(publication: Publication): Y.Map<unknown> {
  const row = new Y.Map<unknown>();

  Object.entries(publication).forEach(([key, value]) => {
    // `sources` is the one field two people can each add to and keep both, so
    // it is the one held as a list that merges rather than replaces.
    row.set(key, key === "sources" ? asArray(value as string[]) : value);
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
  return order(doc).toArray().map(idFromText);
}

/** How many rows the document holds, without copying their keys out to count them. */
function rowCount(doc: Y.Doc): number {
  return order(doc).length;
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

/**
 * Put a row in under its key, replacing whatever the document held there.
 *
 * The reading order is left alone, so a row can be held without being listed:
 * one being edited that a newer search no longer returned, or one opened on its
 * own.
 */
function putRow(doc: Y.Doc, id: PublicationId, publication: Publication): void {
  rows(doc).set(String(id), rowOf(publication));
}

/** Take rows out of the document, leaving the reading order to the caller. */
function dropRows(doc: Y.Doc, ids: PublicationId[]): void {
  ids.forEach((id) => rows(doc).delete(String(id)));
}

/** Replace the reading order. */
function setOrder(doc: Y.Doc, ids: PublicationId[]): void {
  order(doc).delete(0, order(doc).length);
  order(doc).push(ids.map(String));
}

/** Add keys to the end of the reading order. */
function appendOrder(doc: Y.Doc, ids: PublicationId[]): void {
  order(doc).push(ids.map(String));
}

function removeRow(doc: Y.Doc, id: PublicationId): void {
  write(doc, () => {
    rows(doc).delete(String(id));

    const at = order(doc).toArray().indexOf(String(id));
    if (at >= 0) order(doc).delete(at, 1);
  });
}

/**
 * Write one field of a row, the way the row holds it.
 *
 * A field held as a list that merges is edited into its new value rather than
 * replaced, so that an entry somebody else added at the same moment survives;
 * `rowOf` decides which fields those are. Replacing one would also leave a
 * plain list where the row expects a merging one, and every later edit to it
 * would then be lost. Any other field is replaced.
 */
function setField(
  doc: Y.Doc,
  id: PublicationId,
  attribute: string,
  value: unknown,
): void {
  const row = rows(doc).get(String(id));
  if (!row) return;

  const held = row.get(attribute);

  write(doc, () =>
    held instanceof Y.Array
      ? editList(held as Y.Array<string>, value as string[])
      : row.set(attribute, value),
  );
}

/**
 * A merging list, edited into the new value as the smallest change that produces it.
 *
 * Replacing the array wholesale would lose a source added elsewhere at the same
 * moment, which is the one thing holding sources in a `Y.Array` is for. The
 * common edits — appending one, removing one, changing one in place — are
 * applied as themselves instead.
 */
function editList(held: Y.Array<string>, next: string[]): void {
  const current = held.toArray();

  // Trailing additions and removals are the whole of what the editor does
  // most of the time, and applying them as themselves leaves the rest of the
  // list untouched for anyone editing it at the same moment.
  const common = sharedPrefix(current, next);

  if (common < current.length) held.delete(common, current.length - common);
  if (common < next.length) held.push(next.slice(common));
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

    handlers.onRows([...changed].map(idFromText));
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
  isLocal,
  addRow,
  addRowAfter,
  appendOrder,
  dropRows,
  hold,
  holds,
  keys,
  rowCount,
  observe,
  publicationOf,
  putRow,
  readRow,
  removeRow,
  setAll,
  setField,
  setOrder,
  undoManager,
  write,
};
export type { Order, Rows };

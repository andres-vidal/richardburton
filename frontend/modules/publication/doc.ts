import * as Y from "yjs";

import {
  empty,
  idFromText,
  type Publication,
  type PublicationId,
} from "./model";

/**
 * Functions that read and write a publication store's rows in a Yjs document.
 *
 * Every store keeps its rows in a Yjs document. The store of an import document
 * uses the document shared by everyone who has it open. Any other store creates
 * its own document, which holds the rows it read from the database and the
 * edits made to them.
 *
 * The document holds two shared types. `rows` is a `Y.Map` from row key to a
 * `Y.Map` of the row's fields, so an edit can find its row by key without
 * knowing its position. `order` is a `Y.Array` of the same keys in reading
 * order, since a map has no order.
 *
 * Each field is stored as a plain value, so when two people write the same
 * field, Yjs keeps one of the two values. This is the right result for a title,
 * since merging two titles character by character would give a title neither
 * person typed. `sources` is the exception. It is stored as a `Y.Array`, so
 * when two people each add a source, both sources are kept.
 *
 * The document holds content only. Selection, focus, column visibility and
 * validation errors stay in local atoms, so one person hiding a column does not
 * hide it for anyone else.
 */
type Rows = Y.Map<Y.Map<unknown>>;
type Order = Y.Array<string>;

/**
 * The transaction origin for edits made in this client.
 *
 * The undo manager tracks only this origin, so undo reverts this person's edits
 * and leaves other people's edits alone.
 */
const LOCAL = Symbol("local");

/**
 * The transaction origin for rows this client removed because they were moved
 * to another document.
 *
 * The undo manager does not track it, so an undo cannot bring a moved row back
 * into this document while the row is also in the other one.
 */
const MOVED = Symbol("moved");

/**
 * Returns whether a transaction origin belongs to a change made in this client.
 *
 * An edit has the origin `LOCAL`, and removing moved rows has the origin
 * `MOVED`. An undo or redo has the `Y.UndoManager` that made it as its origin,
 * because Yjs does not reuse the origin of the change it reverts. All of them
 * are local changes, so all of them must be saved and relayed. Checking for
 * `LOCAL` alone would leave an undo in this client only.
 */
const isLocal = (origin: unknown): boolean =>
  origin === LOCAL || origin === MOVED || origin instanceof Y.UndoManager;

/**
 * The transaction origin for rows written into the document as the database
 * returned them.
 *
 * Writing saved rows is not an edit, so the undo manager does not track it and
 * `isLocal` returns false for it.
 */
const SAVED = Symbol("saved");

function rows(doc: Y.Doc): Rows {
  return doc.getMap("rows");
}

function order(doc: Y.Doc): Order {
  return doc.getArray("order");
}

/** Runs `change` in a transaction with the origin `LOCAL`. */
function write<T>(doc: Y.Doc, change: () => T): T {
  return doc.transact(change, LOCAL);
}

/**
 * Runs `change` in a transaction with the origin `SAVED`.
 *
 * Changes made inside it keep `SAVED` even when they call `write`, because a
 * nested `transact` joins the open transaction and keeps its origin.
 */
function hold(doc: Y.Doc, change: () => void): void {
  doc.transact(change, SAVED);
}

/** Builds the `Y.Map` that holds a publication's fields in the document. */
function rowOf(publication: Publication): Y.Map<unknown> {
  const row = new Y.Map<unknown>();

  Object.entries(publication).forEach(([key, value]) => {
    // `sources` is stored as a `Y.Array`, so sources that two people add at
    // the same time are both kept. Every other field is a plain value.
    row.set(key, key === "sources" ? asArray(value as string[]) : value);
  });

  return row;
}

function asArray(values: string[]): Y.Array<string> {
  const array = new Y.Array<string>();
  array.push(values);

  return array;
}

/**
 * Reads a row's `Y.Map` back into a `Publication`, turning each `Y.Array` into
 * a plain array. A field the row does not hold keeps its value from `empty()`.
 */
function publicationOf(row: Y.Map<unknown>): Publication {
  const publication = { ...empty() } as Record<string, unknown>;

  row.forEach((value, key) => {
    publication[key] = value instanceof Y.Array ? value.toArray() : value;
  });

  return publication as Publication;
}

/** Returns the row keys in reading order. */
function keys(doc: Y.Doc): PublicationId[] {
  return order(doc).toArray().map(idFromText);
}

/** Returns the number of rows in the reading order without copying the keys. */
function rowCount(doc: Y.Doc): number {
  return order(doc).length;
}

/**
 * Replaces every row and the reading order with `entries`.
 */
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

/** Adds `entries` at the end, in their order, in one transaction. */
function appendRows(
  doc: Y.Doc,
  entries: { id: PublicationId; publication: Publication }[],
): void {
  write(doc, () => {
    entries.forEach(({ id, publication }) =>
      rows(doc).set(String(id), rowOf(publication)),
    );
    order(doc).push(entries.map(({ id }) => String(id)));
  });
}

/**
 * Removes the rows `ids` and their keys in the reading order, in one
 * transaction with the origin `MOVED`, because they were moved to another
 * document.
 */
function moveOut(doc: Y.Doc, ids: PublicationId[]): void {
  const leaving = new Set(ids.map(String));

  doc.transact(() => {
    dropRows(doc, ids);

    // Deleted from the end, so the positions still to delete do not shift.
    order(doc)
      .toArray()
      .flatMap((key, at) => (leaving.has(key) ? [at] : []))
      .reverse()
      .forEach((at) => order(doc).delete(at, 1));
  }, MOVED);
}

/** Add one row at the end. */
function addRow(doc: Y.Doc, id: PublicationId, publication: Publication): void {
  write(doc, () => {
    rows(doc).set(String(id), rowOf(publication));
    order(doc).push([String(id)]);
  });
}

/**
 * Adds a row right after the row `after`, or at the end when `after` is not in
 * the reading order.
 */
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
 * Writes a row under its key, replacing any row the document held there.
 *
 * It does not change the reading order, so a row can be in the document
 * without being listed. Examples are a row being edited that a newer search did
 * not return, and a row opened on its own page.
 */
function putRow(doc: Y.Doc, id: PublicationId, publication: Publication): void {
  rows(doc).set(String(id), rowOf(publication));
}

/** Removes rows from `rows`. The caller updates the reading order. */
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
 * Writes one field of a row as a local edit. Does nothing when the document
 * does not hold the row.
 *
 * A field stored as a `Y.Array` is edited in place with `editList`, so an entry
 * another person added at the same time is kept. `rowOf` decides which fields
 * are stored this way. Replacing the `Y.Array` with a plain array would also
 * make every later edit to the field replace it instead of merging. Any other
 * field is replaced.
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
 * Edits a `Y.Array` so that it holds `next`.
 *
 * It keeps the entries at the start that the array and `next` share, deletes
 * the entries after them, and appends the rest of `next`. Replacing the whole
 * array would drop a source another person added at the same time.
 */
function editList(held: Y.Array<string>, next: string[]): void {
  const current = held.toArray();

  // The editor mostly adds or removes entries at the end. Keeping the shared
  // prefix leaves the earlier entries untouched for anyone editing the list at
  // the same time.
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
 * Calls `onRows` with the keys of the rows whose content changed, and `onOrder`
 * when the reading order changes. Returns a function that stops observing.
 *
 * Yjs calls observers synchronously at the end of each transaction, so a
 * keystroke can be read in the same tick it was typed. Nothing in `observe`
 * writes to the document, so it cannot trigger itself.
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
      // An event on `rows` itself lists the keys of the rows added or removed.
      // An event inside a row has the row's key as the first entry of its path.
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

/** Returns whether the document holds this row. */
function holds(doc: Y.Doc, id: PublicationId): boolean {
  return rows(doc).has(String(id));
}

/** Returns the row, or null when the document does not hold it. */
function readRow(doc: Y.Doc, id: PublicationId): Publication | null {
  const row = rows(doc).get(String(id));

  return row ? publicationOf(row) : null;
}

/**
 * Creates a `Y.UndoManager` over `rows` and `order` that tracks only the
 * `LOCAL` origin, so undo reverts this person's edits and not other people's.
 *
 * Yjs merges edits made close together in time into one undo step, so a burst
 * of typing is undone at once. Adding a row and then typing into it would merge
 * the same way. To keep them apart, call `stopCapturing` on the manager after
 * adding a row. One undo then reverts the typing and not the row.
 */
function undoManager(doc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager([rows(doc), order(doc)], {
    trackedOrigins: new Set([LOCAL]),
  });
}

export {
  LOCAL,
  MOVED,
  isLocal,
  addRow,
  addRowAfter,
  appendOrder,
  appendRows,
  dropRows,
  hold,
  holds,
  keys,
  moveOut,
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

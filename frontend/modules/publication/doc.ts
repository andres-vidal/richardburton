import * as Y from "yjs";

import { isEqual } from "lodash";

import {
  empty,
  idFromText,
  type Publication,
  type PublicationError,
  type PublicationId,
  type Resemblance,
} from "./model";

/**
 * Functions that read and write a publication store's rows in a Yjs document.
 *
 * Every store keeps its rows in a Yjs document. The store of an import document
 * uses the document shared by everyone who has it open. Any other store creates
 * its own document, which holds the rows it read from the database and the
 * edits made to them.
 *
 * The document holds three shared types. `rows` is a `Y.Map` from row key to a
 * `Y.Map` of the row's fields, so an edit can find its row by key without
 * knowing its position. `order` is a `Y.Array` of the same keys in reading
 * order, since a map has no order. `discarded` is a `Y.Map` that holds the key
 * of each discarded row. A discarded row stays in `rows` and `order`, so
 * bringing it back restores it in its place.
 *
 * Each field is stored as a plain value, so when two people write the same
 * field, Yjs keeps one of the two values. This is the right result for a title,
 * since merging two titles character by character would give a title neither
 * person typed. `sources` is the exception. It is stored as a `Y.Array`, so
 * when two people each add a source, both sources are kept.
 *
 * The document holds the rows and which of them are discarded, so everyone who
 * has the document open sees the same working set. Selection, focus and column
 * visibility stay in local atoms, so one person hiding a column does not hide
 * it for anyone else.
 *
 * The document also holds the results of the last checks, so that a row is
 * checked once and everyone reads the result. `validations` maps a row key to
 * the errors validation found and the content it validated. `resemblances`
 * maps a row key to what the look-alike check found for it, with the row's
 * subject at the time. `checked` holds the subject of all the visible rows that
 * the last look-alike check ran on, under the key `"resemblances"`. Results are
 * written with the origin `CHECKED`, so they are saved and relayed but are not
 * undo steps.
 */
type Rows = Y.Map<Y.Map<unknown>>;
type Order = Y.Array<string>;
type Discarded = Y.Map<true>;

/** What validation found for a row, and the key of the content it validated. */
type Validation = { content: string; errors: PublicationError };

/** What the look-alike check found for a row, and the key of the row's
 * subject at the time. */
type Measured = { at: string; value: Resemblance };

/**
 * The transaction origin for edits made in this client.
 *
 * The undo manager tracks only this origin, so undo reverts this person's edits
 * and leaves other people's edits alone.
 */
const LOCAL = Symbol("local");

/**
 * The transaction origin for check results that this client writes into the
 * document.
 *
 * The undo manager does not track it, so undo never reverts a result.
 */
const CHECKED = Symbol("checked");

/**
 * Returns whether a transaction origin belongs to an edit made in this client:
 * an edit, an undo or a redo.
 *
 * An edit has the origin `LOCAL`. An undo or redo has the `Y.UndoManager` that
 * made it as its origin, because Yjs does not reuse the origin of the change it
 * reverts.
 */
const isEdit = (origin: unknown): boolean =>
  origin === LOCAL || origin instanceof Y.UndoManager;

/**
 * Returns whether a transaction origin belongs to a change made in this client,
 * which must be saved and relayed: an edit (see `isEdit`) or a check result
 * with the origin `CHECKED`. Checking for `LOCAL` alone would leave an undo, or
 * a result, in this client only.
 */
const isLocal = (origin: unknown): boolean =>
  isEdit(origin) || origin === CHECKED;

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

function discarded(doc: Y.Doc): Discarded {
  return doc.getMap("discarded");
}

function validations(doc: Y.Doc): Y.Map<Validation> {
  return doc.getMap("validations");
}

function resemblances(doc: Y.Doc): Y.Map<Measured> {
  return doc.getMap("resemblances");
}

function checked(doc: Y.Doc): Y.Map<string> {
  return doc.getMap("checked");
}

/** Removes the check results stored for a row. */
function forgetResults(doc: Y.Doc, key: string): void {
  validations(doc).delete(key);
  resemblances(doc).delete(key);
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
 * Replaces every row and the reading order with `entries`. No row of `entries`
 * is discarded, and no check result is kept.
 */
function setAll(
  doc: Y.Doc,
  entries: { id: PublicationId; publication: Publication }[],
): void {
  write(doc, () => {
    rows(doc).clear();
    order(doc).delete(0, order(doc).length);
    discarded(doc).clear();
    validations(doc).clear();
    resemblances(doc).clear();
    checked(doc).clear();

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

/**
 * Removes rows from `rows`, together with their discarded mark and their check
 * results. The caller updates the reading order.
 */
function dropRows(doc: Y.Doc, ids: PublicationId[]): void {
  ids.forEach((id) => {
    rows(doc).delete(String(id));
    discarded(doc).delete(String(id));
    forgetResults(doc, String(id));
  });
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

/** Removes a row from the document, with its place in the order, its
 * discarded mark and its check results. */
function removeRow(doc: Y.Doc, id: PublicationId): void {
  write(doc, () => {
    rows(doc).delete(String(id));
    discarded(doc).delete(String(id));
    forgetResults(doc, String(id));

    const at = order(doc).toArray().indexOf(String(id));
    if (at >= 0) order(doc).delete(at, 1);
  });
}

/**
 * Marks rows as discarded as a local edit, or brings them back when
 * `isDiscarded` is false. The rows themselves are not changed.
 */
function setDiscarded(
  doc: Y.Doc,
  ids: PublicationId[],
  isDiscarded: boolean,
): void {
  write(doc, () =>
    ids.forEach((id) =>
      isDiscarded
        ? discarded(doc).set(String(id), true)
        : discarded(doc).delete(String(id)),
    ),
  );
}

/** Returns whether a row is discarded. */
function isDiscarded(doc: Y.Doc, id: PublicationId): boolean {
  return discarded(doc).has(String(id));
}

/** Returns the keys of the discarded rows. */
function discardedKeys(doc: Y.Doc): PublicationId[] {
  return [...discarded(doc).keys()].map(idFromText);
}

/**
 * Stores the validation result of each row in `entries`, with the origin
 * `CHECKED`. A `null` result removes the row's result.
 */
function putValidations(
  doc: Y.Doc,
  entries: (readonly [PublicationId, Validation | null])[],
): void {
  doc.transact(
    () =>
      entries.forEach(([id, validation]) =>
        validation
          ? validations(doc).set(String(id), validation)
          : validations(doc).delete(String(id)),
      ),
    CHECKED,
  );
}

/** Returns a row's stored validation result, or null when it has none. */
function validationOf(doc: Y.Doc, id: PublicationId): Validation | null {
  return validations(doc).get(String(id)) ?? null;
}

/**
 * Stores the look-alike check result of each row in `entries`, and `subject`
 * as the subject of the visible rows that the check ran on, with the origin
 * `CHECKED`. A `null` result removes the row's result. A result equal to the
 * stored one is not written again.
 */
function putResemblances(
  doc: Y.Doc,
  entries: (readonly [PublicationId, Measured | null])[],
  subject: string,
): void {
  doc.transact(() => {
    entries.forEach(([id, measured]) => {
      const key = String(id);
      if (isEqual(resemblances(doc).get(key) ?? null, measured)) return;

      if (measured) resemblances(doc).set(key, measured);
      else resemblances(doc).delete(key);
    });

    if (checked(doc).get("resemblances") !== subject) {
      checked(doc).set("resemblances", subject);
    }
  }, CHECKED);
}

/** Returns a row's stored look-alike check result, or null when it has none. */
function measuredOf(doc: Y.Doc, id: PublicationId): Measured | null {
  return resemblances(doc).get(String(id)) ?? null;
}

/**
 * Returns the subject of the visible rows that the last look-alike check ran
 * on, or undefined when no check has run.
 */
function checkedSubject(doc: Y.Doc): string | undefined {
  return checked(doc).get("resemblances");
}

/** Returns the keys of the rows with a stored validation result. */
function validatedKeys(doc: Y.Doc): PublicationId[] {
  return [...validations(doc).keys()].map(idFromText);
}

/** Returns the keys of the rows with a stored look-alike check result. */
function measuredKeys(doc: Y.Doc): PublicationId[] {
  return [...resemblances(doc).keys()].map(idFromText);
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
 * Calls `onRows` with the keys of the rows whose content changed, `onOrder`
 * when the reading order changes, and `onDiscarded` with the keys of the rows
 * discarded or brought back. Each of the three also receives whether the
 * change was an edit made in this client (see `isEdit`). `onValidations` and
 * `onResemblances` receive the keys of the rows whose check results changed.
 * Returns a function that stops observing.
 *
 * Yjs calls observers synchronously at the end of each transaction, so a
 * keystroke can be read in the same tick it was typed. Nothing in `observe`
 * writes to the document, so it cannot trigger itself.
 */
function observe(
  doc: Y.Doc,
  handlers: {
    onRows: (changed: PublicationId[], edit: boolean) => void;
    onOrder: (edit: boolean) => void;
    onDiscarded?: (changed: PublicationId[], edit: boolean) => void;
    onValidations?: (changed: PublicationId[]) => void;
    onResemblances?: (changed: PublicationId[]) => void;
  },
): () => void {
  const onRows = (
    events: Y.YEvent<Y.AbstractType<unknown>>[],
    transaction: Y.Transaction,
  ) => {
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

    handlers.onRows([...changed].map(idFromText), isEdit(transaction.origin));
  };

  const onOrder = (_event: Y.YArrayEvent<string>, transaction: Y.Transaction) =>
    handlers.onOrder(isEdit(transaction.origin));

  const onDiscarded = (event: Y.YMapEvent<true>, transaction: Y.Transaction) =>
    handlers.onDiscarded?.(
      [...event.keysChanged].map(idFromText),
      isEdit(transaction.origin),
    );

  const onValidations = (event: Y.YMapEvent<Validation>) =>
    handlers.onValidations?.([...event.keysChanged].map(idFromText));

  const onResemblances = (event: Y.YMapEvent<Measured>) =>
    handlers.onResemblances?.([...event.keysChanged].map(idFromText));

  rows(doc).observeDeep(onRows);
  order(doc).observe(onOrder);
  discarded(doc).observe(onDiscarded);
  validations(doc).observe(onValidations);
  resemblances(doc).observe(onResemblances);

  return () => {
    rows(doc).unobserveDeep(onRows);
    order(doc).unobserve(onOrder);
    discarded(doc).unobserve(onDiscarded);
    validations(doc).unobserve(onValidations);
    resemblances(doc).unobserve(onResemblances);
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
 * Creates a `Y.UndoManager` over `rows`, `order` and `discarded` that tracks
 * only the `LOCAL` origin, so undo reverts this person's edits and discards,
 * and not other people's.
 *
 * Yjs merges edits made close together in time into one undo step, so a burst
 * of typing is undone at once. Adding a row and then typing into it would merge
 * the same way. To keep them apart, call `stopCapturing` on the manager after
 * adding a row. One undo then reverts the typing and not the row.
 */
function undoManager(doc: Y.Doc): Y.UndoManager {
  return new Y.UndoManager([rows(doc), order(doc), discarded(doc)], {
    trackedOrigins: new Set([LOCAL]),
  });
}

export {
  CHECKED,
  LOCAL,
  checkedSubject,
  isEdit,
  isLocal,
  measuredKeys,
  measuredOf,
  putResemblances,
  putValidations,
  validatedKeys,
  validationOf,
  addRow,
  addRowAfter,
  appendOrder,
  discardedKeys,
  dropRows,
  hold,
  holds,
  isDiscarded,
  keys,
  rowCount,
  observe,
  publicationOf,
  putRow,
  readRow,
  removeRow,
  setAll,
  setDiscarded,
  setField,
  setOrder,
  undoManager,
  write,
};
export type { Discarded, Measured, Order, Rows, Validation };

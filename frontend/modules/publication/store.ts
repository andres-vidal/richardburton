import { v4 as uuid } from "uuid";
import { Atom, atom } from "jotai";
import { atomFamily } from "jotai-family";
import { RESET, atomWithReset } from "jotai/utils";
import type { Store } from "modules/store";
import * as Y from "yjs";
import * as Doc from "./doc";
import {
  ATTRIBUTES,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  Matched,
  Publication,
  PublicationEntry,
  PublicationError,
  PublicationId,
  PublicationKey,
  errorCode,
  empty,
  idFromText,
} from "./model";

/**
 * Well-known key for the always-present "new publication" draft row. Persisted
 * rows are addressed by their server id (a number) and unsaved rows by a UUID,
 * so a reserved word collides with neither.
 */
const DRAFT_ID: PublicationId = "draft";

/**
 * Mint a key for an unsaved row (upload, review, duplicate).
 *
 * A UUID rather than a counter, because the key has to name the same row to two
 * people editing a workspace at once: a counter restarts at the same value in
 * every browser, so two rows entered separately would claim one key. Persisted
 * rows are addressed by their real server id instead.
 */
function createId(): PublicationId {
  return uuid();
}

/**
 * The document a store's rows live in, and the undo that walks back this
 * person's own edits to it.
 */
type StoreDocument = { doc: Y.Doc; undo: Y.UndoManager };

/**
 * A store's document, with the way to stop the atoms following it.
 *
 * `owned` is true when the store made the document itself, and false when it
 * was handed one to work in. Only a document the store owns is the store's to
 * throw away.
 */
type Binding = StoreDocument & { stop: () => void; owned: boolean };

/**
 * Which store holds which document.
 *
 * Every store has one. The store of an import document is handed that document
 * by `openWorkspace`. Any other store makes a document of its own the first
 * time it needs one. Holding the pairing here is what lets every action take
 * only the store.
 */
const documents = new WeakMap<Store, Binding>();

/** The document this store works in, made on first use where it was handed none. */
function documentOf(store: Store): StoreDocument {
  return documents.get(store) ?? bind(store, new Y.Doc(), true);
}

/**
 * Make `doc` the document this store works in, and keep the atoms reading it.
 *
 * One observer writes the document into the atoms, and nothing writes back, so
 * there is no echo to break. Everything downstream reads atoms: the families,
 * the cells and the marking hooks never see the document.
 *
 * The document the store worked in before, if any, stops being followed, so no
 * two observers write one store.
 */
function bind(store: Store, doc: Y.Doc, owned: boolean): Binding {
  documents.get(store)?.stop();

  const undo = Doc.undoManager(doc);

  const onRows = (changed: PublicationId[]) =>
    changed.forEach((id) => {
      const row = Doc.readRow(doc, id);
      if (row) store.set(publicationFamily(id), row);
    });

  const onOrder = () => store.set(publicationIdsAtom, Doc.keys(doc));

  const stopObserving = Doc.observe(doc, { onRows, onOrder });

  // A document the store was handed may already hold rows, restored from disk
  // or arrived from elsewhere before anything subscribed. One it has just made
  // holds nothing, and reading it would claim a working set nobody loaded.
  if (!owned) {
    onRows(Doc.keys(doc));
    onOrder();
  }

  const binding: Binding = {
    doc,
    undo,
    owned,
    stop: () => {
      stopObserving();
      undo.destroy();
    },
  };

  documents.set(store, binding);

  return binding;
}

/**
 * Work in an import document: one this store was handed, which other people
 * may be editing too.
 *
 * Returns the way to stop. The document stays the caller's, and is left as it
 * is.
 */
function openWorkspace(store: Store, doc: Y.Doc): () => void {
  const binding = bind(store, doc, false);

  return () => {
    binding.stop();
    if (documents.get(store) === binding) documents.delete(store);
  };
}

// --- Base atoms -------------------------------------------------------------

const totalIndexCountAtom = atom<number | null>(null);

/**
 * The ordering a query answered with: the ids of every match, in the order they
 * are to be read. Frozen when the query is first answered, so scrolling through
 * it cannot drift as the database changes underneath — a record inserted or
 * removed afterwards does not shift which rows a later page draws.
 */
const orderAtom = atom<PublicationId[]>([]);

/** How many publications answered the current query — the length of its
 * ordering, across every page. */
const matchingCountAtom = atom((get) => get(orderAtom).length);

/** How many a page holds, as the server counts them. */
const perPageAtom = atom<number>(0);

/** How far into the ordering the reader has drawn, by position — advanced a
 * page's worth at a time, whatever number of rows actually came back, so a
 * record removed since the ordering froze is stepped over rather than retried. */
const drawnCountAtom = atom<number>(0);

/** Whether a further page is being fetched — one flight at a time, so a scroll
 * that lingers at the foot does not ask for the same page twice. */
const isLoadingMoreAtom = atom<boolean>(false);

const publicationIdsAtom = atomWithReset<PublicationId[] | undefined>(
  undefined,
);
/** The words the current search matched with something other than what was
 * typed, grouped by field. Shown to the reader so that a widened or
 * field-scoped match explains itself. Note this is not what highlights the
 * rows — each row carries its own highlighting. */
const matchedAtom = atom<Matched[] | undefined>(undefined);
const isValidatingAtom = atom(false);
const areRowIdsVisibleAtom = atom(false);
const focusedRowIdAtom = atomWithReset<PublicationId | undefined>(undefined);

// --- Per-publication families ----------------------------------------------

/**
 * Each row as the store's document holds it, with any edit made to it.
 *
 * A row the document does not hold reads as `undefined`, although it is typed
 * as a Publication. The draft row is not held in the document, and starts empty
 * so it can be typed into immediately.
 */
const publicationFamily = atomFamily((id: PublicationId) =>
  atomWithReset<Publication>(
    id === DRAFT_ID ? empty() : (undefined as unknown as Publication),
  ),
);

/**
 * Each publication as the database last returned it.
 *
 * The row in the document is the one being edited, so while an edit is unsaved
 * the two differ. Reading this instead is how a read-only view of the database
 * keeps showing what is saved while an editor over it holds something else. A
 * row that was never saved, as in an import document, has none.
 */
const savedFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<Publication | undefined>(undefined),
);

const errorFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<PublicationError>(null),
);

const discardedFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<boolean>(false),
);

const lastValidatedFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<string | undefined>(undefined),
);

const attributeVisibleFamily = atomFamily((key: PublicationKey) =>
  atomWithReset<boolean>(DEFAULT_ATTRIBUTE_VISIBILITY[key]),
);

// --- Derived atoms ----------------------------------------------------------

const visibleIdsAtom = atom((get) =>
  get(publicationIdsAtom)?.filter((id) => !get(discardedFamily(id))),
);

const discardedIdsAtom = atom((get) =>
  get(publicationIdsAtom)?.filter((id) => get(discardedFamily(id))),
);

const validIdsAtom = atom((get) =>
  get(publicationIdsAtom)
    ?.filter((id) => !get(discardedFamily(id)))
    .filter((id) => !get(errorFamily(id))),
);

/** The rows something is wrong with, in the order they are shown. */
const invalidIdsAtom = atom(
  (get) => get(visibleIdsAtom)?.filter((id) => get(errorFamily(id))) ?? [],
);

const visibleCountAtom = atom((get) => get(visibleIdsAtom)?.length || 0);

/** Each visible row's place in the working set, counting from one. */
const rowOrderAtom = atom((get) => {
  const at = new Map<PublicationId, number>();

  (get(visibleIdsAtom) ?? []).forEach((id, index) => at.set(id, index + 1));

  return at;
});

/**
 * Where a row sits in the working set, counting from one, or 0 for a row that is
 * not in it.
 *
 * Counted from the order rather than read off the key: a key names a row without
 * saying where it sits, and an unsaved row’s key is a UUID. It is looked up in
 * one map of every row's place rather than searched for in the list, since a
 * search per row is the whole list per row and every row on screen asks at once.
 */
const rowNumberFamily = atomFamily((id: PublicationId) =>
  atom<number>((get) => get(rowOrderAtom).get(id) ?? 0),
);
const discardedCountAtom = atom((get) => get(discardedIdsAtom)?.length || 0);
const validCountAtom = atom((get) => get(validIdsAtom)?.length || 0);
const totalCountAtom = atom((get) => get(publicationIdsAtom)?.length || 0);

const visibleAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => get(attributeVisibleFamily(key))),
);

const hiddenAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => !get(attributeVisibleFamily(key))),
);

// --- Derived families -------------------------------------------------------

/** A row's provenance list, edits and all, and never undefined. */
const publicationSourcesFamily = atomFamily((id: PublicationId) =>
  atom<string[]>((get) => get(publicationFamily(id))?.sources ?? []),
);

/** The matching text of each of a publication's fields, with the matched words
 * wrapped in `[[ ]]`. Undefined outside a search, and null for any field the
 * search did not match. */
const publicationExcerptsFamily = atomFamily((id: PublicationId) =>
  atom<Record<string, string | null> | undefined>(
    (get) => get(savedFamily(id))?.excerpts,
  ),
);

/** A publication's saved provenance list, ignoring any unsaved edit to it, and
 * never undefined. */
const storedSourcesFamily = atomFamily((id: PublicationId) =>
  atom<string[]>((get) => get(savedFamily(id))?.sources ?? []),
);

/** How many loaded publications still have no *saved* sources — drives the
 * backfill wizard's counter and queue dots, updating as saves land (drafts
 * don't count until they're persisted). */
const unsourcedCountAtom = atom(
  (get) =>
    get(publicationIdsAtom)?.filter(
      (id) => get(storedSourcesFamily(id)).length === 0,
    ).length || 0,
);

const isValidFamily = atomFamily((id: PublicationId) =>
  atom((get) => !get(errorFamily(id))),
);

const errorCodeFamily = atomFamily((id: PublicationId) =>
  atom((get) => errorCode(get(errorFamily(id)))),
);

/**
 * Which cell an atom belongs to: the publication, and the attribute of it.
 */
type FieldKey = { id: PublicationId; key: PublicationKey };
type CellKey = `${PublicationId}:${PublicationKey}`;

const cellKey = ({ id, key }: FieldKey): CellKey => `${id}:${key}`;

const fieldKey = (cell: CellKey): FieldKey => {
  const separator = cell.indexOf(":");

  return {
    id: idFromText(cell.slice(0, separator)),
    key: cell.slice(separator + 1) as PublicationKey,
  };
};

/**
 * Cache a per-cell atom under a *string* key, keeping the `{id, key}` call
 * signature.
 *
 * `atomFamily` only takes its `Map.get` fast path when no custom comparator is
 * passed; give it one and it linear-scans the whole cache on every lookup. These
 * caches hold an entry per cell (ids × attributes) and are read on every cell
 * render, so an object key made lookup cost grow with the size of the index.
 */
function cellFamily<T>(initialize: (field: FieldKey) => Atom<T>) {
  const family = atomFamily((cell: CellKey) => initialize(fieldKey(cell)));
  const read = (field: FieldKey) => family(cellKey(field));

  // Cells are keyed by a string, so forgetting publications means finding their
  // cells first — the whole batch in one pass, since a search drops as many ids
  // as it keeps. Snapshot the keys before removing: `getParams` iterates the
  // live cache.
  read.forget = (ids: Set<PublicationId>) =>
    [...family.getParams()]
      .filter((cell) => ids.has(fieldKey(cell).id))
      .forEach((cell) => family.remove(cell));

  return read;
}

/** A single cell's value — its own subscription, so editing one cell is cheap. */
const fieldValueFamily = cellFamily(({ id, key }) =>
  atom((get) => get(publicationFamily(id))?.[key]),
);

/**
 * A single cell's saved value, ignoring any unsaved edit: what the server last
 * returned. The read-only index reads this, since an editor open over it edits
 * the same rows.
 */
const storedFieldValueFamily = cellFamily(({ id, key }) =>
  atom((get) => get(savedFamily(id))?.[key]),
);

const fieldErrorCodeFamily = cellFamily(({ id, key }) =>
  atom((get) => errorCode(get(errorFamily(id)), key)),
);

// --- Family lifecycle -------------------------------------------------------

/**
 * Every family keyed by a publication id. A family's cache is a `param → atom`
 * map that lives in this module, so an id that is never removed keeps its atom
 * for the life of the tab — and a session that searches a few times has typed
 * every result it ever saw.
 */
const PUBLICATION_FAMILIES = [
  publicationFamily,
  savedFamily,
  errorFamily,
  discardedFamily,
  lastValidatedFamily,
  publicationSourcesFamily,
  publicationExcerptsFamily,
  storedSourcesFamily,
  isValidFamily,
  errorCodeFamily,
  rowNumberFamily,
];

const CELL_FAMILIES = [
  fieldValueFamily,
  storedFieldValueFamily,
  fieldErrorCodeFamily,
];

/**
 * A page of the database: the rows, what the search matched, and how many
 * publications exist in total — which the index reports in a header rather
 * than in the body.
 */
type PublicationIndex = {
  entries: Publication[];
  /** What to tell the reader the search matched: the words it resolved to,
   * grouped by the field each was searched in. */
  matched: Matched[];
  /** How many exist in total, not how many matched. `null` when unreported. */
  total: number | null;
  /** The ids of every match, in reading order — the ordering the reader scrolls
   * through, frozen when the query was answered. */
  order: PublicationId[];
  /** How many a page holds, as the server counts them. */
  perPage: number;
};

/** Drop every atom these publications own — their values and their cached cells. */
function forget(ids: Iterable<PublicationId>): void {
  const dropped = new Set(ids);

  dropped.forEach((id) =>
    PUBLICATION_FAMILIES.forEach((family) => family.remove(id)),
  );
  CELL_FAMILIES.forEach((family) => family.forget(dropped));
}

/** Every id any family still holds, including ones set without going through
 * `publicationIdsAtom` — which is what makes teardown reach them. */
function knownIds(): Set<PublicationId> {
  return new Set(
    PUBLICATION_FAMILIES.flatMap((family) => [...family.getParams()]),
  );
}

// --- Actions (imperative; operate on the module `store`) --------------------

/** The fields a person edits, which are the ones that tell an edited row from its saved copy. */
const EDITED_FIELDS = [...ATTRIBUTES, "sources"] as const;

/** A publication's edited fields as text, in a fixed order, so that two copies compare by value. */
function contentOf(publication: Publication): string {
  const complete = { ...empty(), ...publication };

  return JSON.stringify(EDITED_FIELDS.map((field) => complete[field]));
}

/**
 * Whether a row holds an edit the database does not have yet.
 *
 * A row is edited when the document's copy differs from the saved one in a
 * field a person edits. A row with no saved copy has nothing to differ from,
 * so it is never counted as edited.
 */
function isEdited(store: Store, id: PublicationId): boolean {
  const saved = store.get(savedFamily(id));
  const row = store.get(publicationFamily(id));

  return (
    saved !== undefined &&
    row !== undefined &&
    contentOf(row) !== contentOf(saved)
  );
}

/**
 * Hold publications as the database has them: each one's saved copy, and its
 * row in the document. It is called inside `Doc.hold`, alongside the change to
 * the reading order that goes with it.
 *
 * A row with an unsaved edit keeps the edit, and only its saved copy moves, so
 * results arriving behind an open editor do not undo what is being typed.
 */
function holdSaved(
  store: Store,
  doc: Y.Doc,
  publications: Publication[],
): void {
  publications.forEach((publication) => {
    const id = publication.id!;

    if (!isEdited(store, id)) Doc.putRow(doc, id, publication);
    store.set(savedFamily(id), publication);
  });
}

/**
 * Seed the store with publications the backend has already saved, keyed by
 * their server ids — the one definition of "these rows are now the working set".
 *
 * Ids that leave the set are forgotten, so searching does not accumulate every
 * publication seen this session. A row with an unsaved edit is kept, outside
 * the reading order: a search running behind an open editor must not discard
 * what is being typed.
 */
function hydrate(store: Store, publications: Publication[]): PublicationId[] {
  const { doc } = documentOf(store);
  const ids: PublicationId[] = publications.map(
    (publication) => publication.id!,
  );
  const arriving = new Set(ids);

  const leaving = [...knownIds()]
    .filter((id) => id !== DRAFT_ID && !arriving.has(id))
    .filter((id) => !isEdited(store, id));

  Doc.hold(doc, () => {
    Doc.dropRows(doc, leaving);
    holdSaved(store, doc, publications);
    Doc.setOrder(doc, ids);
  });

  forget(leaving);

  return ids;
}

/**
 * Make one saved publication known to the store without claiming it is the
 * working set: its saved copy, and its row in the document, replacing whatever
 * the row held. It is the counterpart of `forget`. A surface showing a single
 * record (a publication's own page) needs it before the record can be edited,
 * since the form edits the store's row.
 */
function remember(store: Store, publication: Publication): void {
  const { doc } = documentOf(store);

  store.set(savedFamily(publication.id!), publication);
  Doc.hold(doc, () => Doc.putRow(doc, publication.id!, publication));
}

/**
 * Take an index payload as the working set: the rows, what the search matched,
 * and how many publications exist in total.
 *
 * One definition of "these are the results now", wherever they were read.
 */
function receiveIndex(
  store: Store,
  { entries, matched, total, order, perPage }: PublicationIndex,
): PublicationId[] {
  if (total !== null) store.set(totalIndexCountAtom, total);
  store.set(matchedAtom, matched);
  store.set(orderAtom, order);
  store.set(perPageAtom, perPage);
  // The first page has drawn as far into the ordering as it holds rows.
  store.set(drawnCountAtom, Math.min(order.length, perPage || entries.length));

  return hydrate(store, entries);
}

/**
 * Add a further page of results to the working set, keeping the ones already
 * loaded — infinite scroll grows the list rather than replacing it. An id
 * already present is skipped, so a record that shifts across the page boundary
 * (a deletion between fetches) is never doubled.
 */
function appendIndex(store: Store, entries: Publication[]): void {
  const { doc } = documentOf(store);
  const present = new Set(Doc.keys(doc));
  const fresh = entries.filter((publication) => !present.has(publication.id!));

  Doc.hold(doc, () => {
    holdSaved(store, doc, fresh);
    Doc.appendOrder(
      doc,
      fresh.map(({ id }) => id!),
    );
  });
}

function setAll(store: Store, entries: PublicationEntry[]): void {
  const { doc, undo } = documentOf(store);

  // Errors are never shared: they are what this person's copy was told when it
  // last asked, so they stay in atoms.
  entries.forEach(({ id, errors }) => store.set(errorFamily(id), errors));

  Doc.setAll(doc, entries);
  undo.stopCapturing();

  // Replacing an empty working set with another changes nothing, so the
  // observer has nothing to report and the order has to be cleared here.
  // Anything else the observer has already written, and writing it twice
  // redraws the whole table for the second one.
  if (entries.length === 0) store.set(publicationIdsAtom, []);
}

function setErrors(store: Store, entries: PublicationEntry[]): void {
  entries.forEach(({ id, errors }) => store.set(errorFamily(id), errors));
}

function setDiscarded(
  store: Store,
  ids: PublicationId[],
  isDeleted = true,
): void {
  ids.forEach((id) => store.set(discardedFamily(id), isDeleted));
}

function setFocusedRowId(store: Store, id: PublicationId | undefined): void {
  store.set(focusedRowIdAtom, id);
}

/** Edit one field of a row. */
function setField<K extends PublicationKey>(
  store: Store,
  id: PublicationId,
  attribute: K,
  value: Publication[K],
): void {
  writeRow(store, id, { [attribute]: value });
}

/** Edit a row's whole provenance list, which is edited as a unit rather than
 * per cell. */
function setSources(store: Store, id: PublicationId, sources: string[]): void {
  writeRow(store, id, { sources });
}

/**
 * Write an edit to a row, in the place that row lives.
 *
 * A row is edited in the store's document, and the edit is its value. The
 * draft row is the one row kept out of the document, because a row nobody has
 * added yet should not reach the people sharing an import document. What is
 * typed into it stays in its atom until `addNew` hands it over.
 *
 * An edit to a row the document no longer holds, such as one a collaborator
 * removed, changes nothing.
 */
function writeRow(
  store: Store,
  id: PublicationId,
  fields: Partial<Publication>,
): void {
  if (id === DRAFT_ID) {
    store.set(publicationFamily(DRAFT_ID), {
      ...store.get(publicationFamily(DRAFT_ID)),
      ...fields,
    });
    return;
  }

  const { doc } = documentOf(store);

  Doc.write(doc, () =>
    Object.entries(fields).forEach(([attribute, value]) =>
      Doc.setField(doc, id, attribute, value),
    ),
  );
}

/**
 * Cancel an edit: put a row back the way it was saved, and drop its errors.
 * A row that was never saved has nothing to go back to, and keeps what it
 * holds.
 */
function discardEdit(store: Store, id: PublicationId): void {
  const saved = store.get(savedFamily(id));

  if (saved) remember(store, saved);
  store.set(errorFamily(id), RESET);
}

function setAttributesVisible(
  store: Store,
  keys: PublicationKey[],
  isVisible = true,
): void {
  keys.forEach((key) => store.set(attributeVisibleFamily(key), isVisible));
}

/** Register the draft row as a new publication and clear the draft. */
function addNew(store: Store): PublicationId {
  const ids = store.get(publicationIdsAtom);
  if (!ids) throw "Can not add new publications: entries not loaded.";

  const { doc, undo } = documentOf(store);
  const id = createId();

  Doc.addRow(doc, id, store.get(publicationFamily(DRAFT_ID)));
  // Adding a row and typing into it are different steps to walk back.
  undo.stopCapturing();
  store.set(publicationFamily(DRAFT_ID), empty());

  return id;
}

/** Duplicate each selected publication, inserting the copy right after it. */
function duplicate(
  store: Store,
  duplicateIds: Set<PublicationId>,
): PublicationId[] {
  const ids = store.get(publicationIdsAtom);
  if (!ids) throw "Can not duplicate publications: entries not loaded.";

  const { doc, undo } = documentOf(store);
  const copies = new Map(
    ids.filter((id) => duplicateIds.has(id)).map((id) => [id, createId()]),
  );

  // One transaction for the lot: the observer rebuilds the lists once, the
  // copies are saved and relayed as one change, and undoing takes them all
  // back in one step, the way they were made.
  Doc.write(doc, () =>
    copies.forEach((copy, source) =>
      Doc.addRowAfter(doc, source, copy, store.get(publicationFamily(source))),
    ),
  );
  undo.stopCapturing();

  return [...copies.values()];
}

/**
 * Empty a store, without reaching into any other.
 *
 * Values are the store's own, so resetting them is its business alone. The atom
 * *caches* are not: they are keyed by id and shared by every store, so a surface
 * emptying itself must not evict from them — another surface may be reading the
 * same ids right now. `hydrate` prunes them instead, for the store that owns
 * what is arriving.
 *
 * Every id the families know, not just the ones currently listed: a value set
 * directly — as the specs do — would otherwise survive teardown.
 *
 * A document the store made for itself is dropped with the rest, and the next
 * write makes a fresh one. A document the store was handed is left as it is.
 * Emptying that one would be an edit everyone sharing it sees, and `setAll`
 * replaces its rows as one step when the store fills again.
 */
function resetAll(store: Store): void {
  knownIds().forEach((id) => {
    store.set(publicationFamily(id), RESET);
    store.set(savedFamily(id), RESET);
    store.set(errorFamily(id), RESET);
    store.set(discardedFamily(id), RESET);
    store.set(lastValidatedFamily(id), RESET);
  });

  store.set(publicationIdsAtom, RESET);
  store.set(focusedRowIdAtom, RESET);

  const binding = documents.get(store);

  if (binding?.owned) {
    binding.stop();
    documents.delete(store);
  }
}

function resetDiscarded(store: Store): void {
  store
    .get(discardedIdsAtom)
    ?.forEach((id) => store.set(discardedFamily(id), RESET));
}

/**
 * Drop a publication that no longer exists on the server (after a server-side
 * delete): remove its id from the index and reset its per-row state. Distinct
 * from the workspace's `setDiscarded`, which only hides rows in memory.
 */
function removePublication(store: Store, id: PublicationId): void {
  const { doc, undo } = documentOf(store);

  Doc.removeRow(doc, id);
  undo.stopCapturing();

  store.set(publicationFamily(id), RESET);
  store.set(savedFamily(id), RESET);
  store.set(errorFamily(id), RESET);
  store.set(discardedFamily(id), RESET);
  store.set(lastValidatedFamily(id), RESET);

  // Keep the footer's "N publications registered" honest without a refetch.
  const total = store.get(totalIndexCountAtom);
  if (total !== null) {
    store.set(totalIndexCountAtom, total - 1);
  }
}

function resetAttributes(store: Store): void {
  ATTRIBUTES.forEach((key) => store.set(attributeVisibleFamily(key), RESET));
}

/** Focus the next invalid row after the currently focused one (wrapping). */
function focusNextInvalid(store: Store): void {
  const visibleIds = store.get(visibleIdsAtom);
  if (!visibleIds) return;

  const isInvalid = (id: PublicationId) => store.get(errorFamily(id));
  const focusedId = store.get(focusedRowIdAtom);
  // Walk by list position (ids are no longer monotonic once rows are keyed by
  // server id), then wrap to the first invalid row.
  const start = focusedId === undefined ? -1 : visibleIds.indexOf(focusedId);
  const nextInvalidId =
    visibleIds.slice(start + 1).find(isInvalid) ?? visibleIds.find(isInvalid);

  store.set(focusedRowIdAtom, nextInvalidId);
}

export {
  addNew,
  appendIndex,
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  createId,
  discardedCountAtom,
  discardEdit,
  documentOf,
  DRAFT_ID,
  drawnCountAtom,
  duplicate,
  errorCodeFamily,
  errorFamily,
  fieldErrorCodeFamily,
  fieldValueFamily,
  focusedRowIdAtom,
  focusNextInvalid,
  forget,
  hiddenAttributesAtom,
  hydrate,
  invalidIdsAtom,
  isLoadingMoreAtom,
  isValidatingAtom,
  isValidFamily,
  knownIds,
  lastValidatedFamily,
  matchedAtom,
  matchingCountAtom,
  openWorkspace,
  orderAtom,
  perPageAtom,
  publicationExcerptsFamily,
  publicationFamily,
  publicationIdsAtom,
  publicationSourcesFamily,
  receiveIndex,
  remember,
  removePublication,
  resetAll,
  resetAttributes,
  resetDiscarded,
  rowNumberFamily,
  savedFamily,
  setAll,
  setAttributesVisible,
  setDiscarded,
  setErrors,
  setField,
  setFocusedRowId,
  setSources,
  storedFieldValueFamily,
  storedSourcesFamily,
  totalCountAtom,
  totalIndexCountAtom,
  unsourcedCountAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
};
export type { PublicationIndex };

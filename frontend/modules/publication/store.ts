import { Atom, atom } from "jotai";
import { atomFamily } from "jotai-family";
import { RESET, atomWithReset } from "jotai/utils";
import type { Store } from "modules/store";
import {
  ATTRIBUTES,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  Publication,
  PublicationEntry,
  PublicationError,
  PublicationId,
  PublicationKey,
  describeError,
  empty,
} from "./model";

/**
 * Well-known id for the always-present "new publication" draft row. Persisted
 * rows are addressed by their server id (the publication PK, positive) and
 * unsaved rows by a client-minted id (negative, see `createId`), so `0` never
 * collides with either.
 */
const DRAFT_ID: PublicationId = 0;

let sequence = -1;
/**
 * Mint a client id for an unsaved row (upload/review/duplicate). Negative and
 * descending so it can never collide with a server id (positive) or the draft
 * (`0`); persisted rows are addressed by their real server id instead.
 */
function createId(): PublicationId {
  return sequence--;
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
const isValidatingAtom = atom(false);
const keywordsAtom = atom<string[] | undefined>(undefined);
const areRowIdsVisibleAtom = atom(false);
const focusedRowIdAtom = atomWithReset<PublicationId | undefined>(undefined);

// --- Per-publication families ----------------------------------------------

const publicationFamily = atomFamily((id: PublicationId) =>
  // Unset rows read as `undefined` (typed as Publication, matching the old
  // model); the draft row starts empty so it can be typed into immediately.
  atomWithReset<Publication>(
    id === DRAFT_ID ? empty() : (undefined as unknown as Publication),
  ),
);

const overrideFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<Partial<Publication> | undefined>(undefined),
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

const overriddenIdsAtom = atom((get) =>
  get(visibleIdsAtom)?.filter((id) => get(overrideFamily(id))),
);

const validIdsAtom = atom((get) =>
  get(publicationIdsAtom)
    ?.filter((id) => !get(discardedFamily(id)))
    .filter((id) => !get(errorFamily(id))),
);

const visibleCountAtom = atom((get) => get(visibleIdsAtom)?.length || 0);
const discardedCountAtom = atom((get) => get(discardedIdsAtom)?.length || 0);
const overriddenCountAtom = atom((get) => get(overriddenIdsAtom)?.length || 0);
const validCountAtom = atom((get) => get(validIdsAtom)?.length || 0);
const totalCountAtom = atom((get) => get(publicationIdsAtom)?.length || 0);

const visibleAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => get(attributeVisibleFamily(key))),
);

const hiddenAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => !get(attributeVisibleFamily(key))),
);

// --- Derived families -------------------------------------------------------

/** A publication with its pending edits (overrides) merged over the base value. */
const visiblePublicationFamily = atomFamily((id: PublicationId) =>
  atom<Publication>((get) => ({
    ...get(publicationFamily(id)),
    ...(get(overrideFamily(id)) || {}),
  })),
);

const publicationOrNullFamily = atomFamily((id: PublicationId) =>
  atom<Publication | null>((get) => get(publicationFamily(id)) || null),
);

/** A publication's provenance list (base ⊕ override), never undefined. */
const publicationReferencesFamily = atomFamily((id: PublicationId) =>
  atom<string[]>((get) => get(visiblePublicationFamily(id)).references ?? []),
);

/** A highlighted snippet of a publication's references, present only when the
 * current search matched on them rather than on the record's own fields. */
const publicationSourceMatchFamily = atomFamily((id: PublicationId) =>
  atom<string | undefined>((get) => get(publicationFamily(id))?.sourceMatch),
);

/** A publication's *persisted* provenance list — ignores in-progress drafts,
 * the same stored-vs-visible distinction as `storedFieldValueFamily`. */
const storedReferencesFamily = atomFamily((id: PublicationId) =>
  atom<string[]>((get) => get(publicationFamily(id))?.references ?? []),
);

/** How many loaded publications still have no *saved* references — drives the
 * backfill wizard's counter and queue dots, updating as saves land (drafts
 * don't count until they're persisted). */
const unreferencedCountAtom = atom(
  (get) =>
    get(publicationIdsAtom)?.filter(
      (id) => get(storedReferencesFamily(id)).length === 0,
    ).length || 0,
);

const isValidFamily = atomFamily((id: PublicationId) =>
  atom((get) => !get(errorFamily(id))),
);

const errorDescriptionFamily = atomFamily((id: PublicationId) =>
  atom((get) => describeError(get(errorFamily(id)))),
);

type FieldKey = { id: PublicationId; key: PublicationKey };
type CellKey = `${PublicationId}:${PublicationKey}`;

const cellKey = ({ id, key }: FieldKey): CellKey => `${id}:${key}`;

const fieldKey = (cell: CellKey): FieldKey => {
  const separator = cell.indexOf(":");
  return {
    id: Number(cell.slice(0, separator)),
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
  atom((get) => get(visiblePublicationFamily(id))[key]),
);

/**
 * A single cell's *stored* value, ignoring pending edits — what the server last
 * returned. The read-only index reads this so an in-progress edit (the modal's
 * draft lives in the same override overlay) doesn't leak into the table beneath.
 */
const storedFieldValueFamily = cellFamily(({ id, key }) =>
  atom((get) => get(publicationFamily(id))[key]),
);

const fieldErrorDescriptionFamily = cellFamily(({ id, key }) =>
  atom((get) => describeError(get(errorFamily(id)), key)),
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
  overrideFamily,
  errorFamily,
  discardedFamily,
  lastValidatedFamily,
  visiblePublicationFamily,
  publicationOrNullFamily,
  publicationReferencesFamily,
  storedReferencesFamily,
  isValidFamily,
  errorDescriptionFamily,
];

const CELL_FAMILIES = [
  fieldValueFamily,
  storedFieldValueFamily,
  fieldErrorDescriptionFamily,
];

/**
 * A page of the database: the rows, the keywords the search matched on, and how
 * many publications exist in total — which the index reports in a header rather
 * than in the body.
 */
type PublicationIndex = {
  entries: Publication[];
  keywords: string[];
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

/**
 * Seed the store with publications the backend has already saved, keyed by
 * their server ids — the one definition of "these rows are now the working set".
 *
 * Ids that leave the set are forgotten, so searching does not accumulate every
 * publication seen this session. A row with a pending edit is kept regardless:
 * a search running behind an open editor must not discard what is being typed.
 */
function hydrate(store: Store, publications: Publication[]): PublicationId[] {
  const ids = publications.map((publication) => publication.id!);
  const arriving = new Set(ids);

  forget(
    [...knownIds()]
      .filter((id) => id !== DRAFT_ID && !arriving.has(id))
      .filter((id) => !store.get(overrideFamily(id))),
  );

  store.set(publicationIdsAtom, ids);
  publications.forEach((publication, index) =>
    store.set(publicationFamily(ids[index]), publication),
  );

  return ids;
}

/**
 * Make one saved publication known to the store without claiming it is the
 * working set — the counterpart of `forget`, and what a surface showing a single
 * record (a publication's own page) needs before it can be edited, since the
 * form edits the store's copy.
 */
function remember(store: Store, publication: Publication): void {
  store.set(publicationFamily(publication.id!), publication);
}

/**
 * Take an index payload as the working set: the rows, the keywords the search
 * matched on, and how many publications exist in total.
 *
 * One definition of "these are the results now", wherever they were read.
 */
function receiveIndex(
  store: Store,
  { entries, keywords, total, order, perPage }: PublicationIndex,
): PublicationId[] {
  if (total !== null) store.set(totalIndexCountAtom, total);
  store.set(keywordsAtom, keywords);
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
  const loaded = store.get(publicationIdsAtom) ?? [];
  const present = new Set(loaded);
  const fresh = entries.filter((publication) => !present.has(publication.id!));

  fresh.forEach((publication) =>
    store.set(publicationFamily(publication.id!), publication),
  );
  store.set(publicationIdsAtom, [...loaded, ...fresh.map(({ id }) => id!)]);
}

function setAll(store: Store, entries: PublicationEntry[]): void {
  store.set(
    publicationIdsAtom,
    entries.map(({ id }) => id),
  );
  entries.forEach(({ id, publication, errors }) => {
    store.set(publicationFamily(id), publication);
    store.set(errorFamily(id), errors);
  });
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

function overrideField(
  store: Store,
  id: PublicationId,
  attribute: PublicationKey,
  value: string,
): void {
  const current = store.get(overrideFamily(id));
  store.set(overrideFamily(id), { ...current, [attribute]: value });
}

/** Overlay the whole provenance list (references are edited as a unit, not per
 * cell), reusing the same override overlay as the scalar fields. */
function overrideReferences(
  store: Store,
  id: PublicationId,
  references: string[],
): void {
  const current = store.get(overrideFamily(id));
  store.set(overrideFamily(id), { ...current, references });
}

/** Drop a single row's pending edits and errors (cancelling an edit). */
function discardEdit(store: Store, id: PublicationId): void {
  store.set(overrideFamily(id), RESET);
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

  const id = createId();
  const draft = store.get(visiblePublicationFamily(DRAFT_ID));

  store.set(publicationIdsAtom, [...ids, id]);
  store.set(publicationFamily(id), draft);
  store.set(overrideFamily(DRAFT_ID), RESET);

  return id;
}

/** Duplicate each selected publication, inserting the copy right after it. */
function duplicate(
  store: Store,
  duplicateIds: Set<PublicationId>,
): PublicationId[] {
  const ids = store.get(publicationIdsAtom);
  if (!ids) throw "Can not duplicate publications: entries not loaded.";

  const newIds: PublicationId[] = [];
  const orderedIds = ids.reduce<PublicationId[]>((acc, current) => {
    if (duplicateIds.has(current)) {
      const newId = createId();
      newIds.push(newId);
      store.set(
        publicationFamily(newId),
        store.get(publicationFamily(current)),
      );
      return [...acc, current, newId];
    }
    return [...acc, current];
  }, []);

  store.set(publicationIdsAtom, orderedIds);
  return newIds;
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
 */
function resetAll(store: Store): void {
  knownIds().forEach((id) => {
    store.set(publicationFamily(id), RESET);
    store.set(overrideFamily(id), RESET);
    store.set(errorFamily(id), RESET);
    store.set(discardedFamily(id), RESET);
    store.set(lastValidatedFamily(id), RESET);
  });

  store.set(publicationIdsAtom, RESET);
  store.set(focusedRowIdAtom, RESET);
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
  const ids = store.get(publicationIdsAtom);
  if (ids) {
    store.set(
      publicationIdsAtom,
      ids.filter((current) => current !== id),
    );
  }

  store.set(publicationFamily(id), RESET);
  store.set(overrideFamily(id), RESET);
  store.set(errorFamily(id), RESET);
  store.set(discardedFamily(id), RESET);
  store.set(lastValidatedFamily(id), RESET);

  // Keep the footer's "N publications registered" honest without a refetch.
  const total = store.get(totalIndexCountAtom);
  if (total !== null) {
    store.set(totalIndexCountAtom, total - 1);
  }
}

function resetOverridden(store: Store): void {
  store
    .get(publicationIdsAtom)
    ?.forEach((id) => store.set(overrideFamily(id), RESET));
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
  DRAFT_ID,
  addNew,
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  createId,
  discardedCountAtom,
  discardEdit,
  drawnCountAtom,
  duplicate,
  errorDescriptionFamily,
  errorFamily,
  fieldErrorDescriptionFamily,
  fieldValueFamily,
  focusNextInvalid,
  focusedRowIdAtom,
  forget,
  hydrate,
  appendIndex,
  knownIds,
  hiddenAttributesAtom,
  isLoadingMoreAtom,
  isValidFamily,
  isValidatingAtom,
  keywordsAtom,
  lastValidatedFamily,
  overriddenCountAtom,
  overriddenIdsAtom,
  overrideFamily,
  overrideField,
  overrideReferences,
  orderAtom,
  publicationFamily,
  publicationIdsAtom,
  publicationOrNullFamily,
  publicationReferencesFamily,
  publicationSourceMatchFamily,
  receiveIndex,
  remember,
  removePublication,
  resetAll,
  resetAttributes,
  resetDiscarded,
  resetOverridden,
  setAll,
  setAttributesVisible,
  setDiscarded,
  setErrors,
  setFocusedRowId,
  storedFieldValueFamily,
  storedReferencesFamily,
  totalCountAtom,
  matchingCountAtom,
  perPageAtom,
  totalIndexCountAtom,
  unreferencedCountAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
  visiblePublicationFamily,
};
export type { PublicationIndex };

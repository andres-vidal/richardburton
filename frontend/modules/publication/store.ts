import { v4 as uuid } from "uuid";
import { Atom, atom } from "jotai";
import { atomFamily } from "jotai-family";
import { RESET, atomWithReset } from "jotai/utils";
import { isEqual } from "lodash";
import type { Store } from "modules/store";
import hash from "object-hash";
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
  Resemblance,
  errorCode,
  empty,
  idFromText,
} from "./model";

/**
 * The key of the "new publication" draft row, which is always present. Saved
 * rows are keyed by their server id, a number, and unsaved rows by a UUID, so
 * the string `"draft"` cannot collide with either.
 */
const DRAFT_ID: PublicationId = "draft";

/**
 * Returns a new key for an unsaved row, as created by upload, review and
 * duplicate.
 *
 * The key is a UUID, so rows created in different browsers at the same time
 * never get the same key. A counter would start from the same value in every
 * browser. Saved rows are keyed by their server id instead.
 */
function createId(): PublicationId {
  return uuid();
}

/**
 * A store's Yjs document, and the undo manager for this person's edits to it.
 */
type StoreDocument = { doc: Y.Doc; undo: Y.UndoManager };

/**
 * A store's document, with `stop`, which detaches the observer that copies the
 * document into the store's atoms.
 *
 * `owned` is true when the store created the document itself, and false when
 * `openWorkspace` gave it one. `resetAll` discards only an owned document.
 */
type Binding = StoreDocument & { stop: () => void; owned: boolean };

/**
 * Maps each store to its document binding.
 *
 * The store of an import document gets that document from `openWorkspace`.
 * Any other store creates its own document the first time it needs one.
 * Keeping the map here means every action needs only the store as an argument.
 */
const documents = new WeakMap<Store, Binding>();

/**
 * Returns the store's document and undo manager. When the store has none, it
 * creates a document and binds it.
 */
function documentOf(store: Store): StoreDocument {
  return documents.get(store) ?? bind(store, new Y.Doc(), true);
}

/**
 * Binds `doc` to the store and starts the observer that copies it into the
 * store's atoms.
 *
 * The observer writes `publicationFamily` for each changed row,
 * `publicationIdsAtom` for the reading order, and `errorFamily` and
 * `measuredResemblanceFamily` for each row whose check results changed. It
 * never writes to the document.
 * The families, the cells and the marking hooks read only the atoms, never the
 * document.
 *
 * Any document bound to the store before is unbound first, so only one
 * observer writes to a store.
 */
function bind(store: Store, doc: Y.Doc, owned: boolean): Binding {
  documents.get(store)?.stop();

  const undo = Doc.undoManager(doc);

  const onRows = (changed: PublicationId[]) =>
    store.set(
      writeRowsAtom,
      changed.flatMap((id) => {
        const row = Doc.readRow(doc, id);
        return row ? [[id, row] as const] : [];
      }),
    );

  const onOrder = () => store.set(publicationIdsAtom, Doc.keys(doc));

  const onValidations = (changed: PublicationId[]) =>
    store.set(
      writeErrorsAtom,
      changed.map(
        (id) => [id, Doc.validationOf(doc, id)?.errors ?? null] as const,
      ),
    );

  const onResemblances = (changed: PublicationId[]) =>
    store.set(
      writeMeasuredAtom,
      changed.map((id) => [id, Doc.measuredOf(doc, id)] as const),
    );

  const stopObserving = Doc.observe(doc, {
    onRows,
    onOrder: () => onOrder(),
    onValidations,
    onResemblances,
  });

  // A document from `openWorkspace` may already hold rows, restored from disk
  // or received before the observer started, so they are copied now. A
  // document the store has just created is empty. Copying its empty order would
  // set `publicationIdsAtom` to `[]` and mark the working set as loaded when
  // nothing was loaded.
  if (!owned) {
    onRows(Doc.keys(doc));
    onValidations(Doc.validatedKeys(doc));
    onResemblances(Doc.measuredKeys(doc));
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
 * Binds the store to an import document that the caller created and that
 * other people may be editing too.
 *
 * Returns a function that unbinds it. The caller keeps ownership of the
 * document, and unbinding does not change it.
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
const isValidatingAtom = atom(false);
const areRowIdsVisibleAtom = atom(false);
const focusedRowIdAtom = atomWithReset<PublicationId | undefined>(undefined);

// --- Per-publication families ----------------------------------------------

/**
 * Each row as the store's document holds it, including unsaved edits.
 *
 * A row the document does not hold reads as `undefined`, although its type is
 * `Publication`. The draft row is not in the document. It starts empty so it
 * can be typed into straight away.
 */
const publicationFamily = atomFamily((id: PublicationId) =>
  atomWithReset<Publication>(
    id === DRAFT_ID ? empty() : (undefined as unknown as Publication),
  ),
);

/**
 * Each publication as the database last returned it.
 *
 * While a row has an unsaved edit, this differs from `publicationFamily`. A
 * read-only view of the database reads this, so it keeps showing the saved
 * value while an editor has an unsaved edit. A row that was never saved, such
 * as a row of an import document, has no value here.
 */
const savedFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<Publication | undefined>(undefined),
);

/**
 * What the last validation of each row found, as the store's document records
 * it, or null. The draft row is not in the document, so its errors are kept
 * here only. Read a row's error through `rowErrorFamily`, which also reports a
 * repeat.
 */
const errorFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<PublicationError>(null),
);

const lastValidatedFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<string | undefined>(undefined),
);

/**
 * The last look-alike check result for a row, as the store's document records
 * it, with the key of the row's subject at the time of the check (`at`). See
 * `rowSubjectKeyFamily`.
 *
 * `resemblanceFamily` compares `at` with the row's current subject key to
 * decide whether the result still applies. Read the result through
 * `resemblanceFamily`, not this atom.
 */
const measuredResemblanceFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<{ at: string; value: Resemblance } | null>(null),
);

const attributeVisibleFamily = atomFamily((key: PublicationKey) =>
  atomWithReset<boolean>(DEFAULT_ATTRIBUTE_VISIBILITY[key]),
);

// --- Write atoms ------------------------------------------------------------

/**
 * Writes each `[id, row]` pair into `publicationFamily` in one store update, so
 * an atom that reads many rows recomputes once instead of once per row.
 */
const writeRowsAtom = atom(
  null,
  (_get, set, rows: (readonly [PublicationId, Publication])[]) =>
    rows.forEach(([id, row]) => set(publicationFamily(id), row)),
);

/**
 * Writes each `[id, errors]` pair into `errorFamily` in one store update, so
 * the valid rows are recomputed once.
 */
const writeErrorsAtom = atom(
  null,
  (_get, set, entries: (readonly [PublicationId, PublicationError])[]) =>
    entries.forEach(([id, errors]) => set(errorFamily(id), errors)),
);

/**
 * Writes each `[id, measured]` pair into `measuredResemblanceFamily` in one
 * store update. A row whose result is unchanged is not written, so its cells do
 * not re-render.
 */
const writeMeasuredAtom = atom(
  null,
  (get, set, entries: (readonly [PublicationId, Doc.Measured | null])[]) =>
    entries.forEach(([id, measured]) => {
      if (!isEqual(get(measuredResemblanceFamily(id)), measured)) {
        set(measuredResemblanceFamily(id), measured);
      }
    }),
);

// --- Derived atoms ----------------------------------------------------------

const validIdsAtom = atom((get) =>
  get(publicationIdsAtom)?.filter((id) => !get(rowErrorFamily(id))),
);

/** The rows something is wrong with, in the order they are shown. */
const invalidIdsAtom = atom(
  (get) =>
    get(publicationIdsAtom)?.filter((id) => get(rowErrorFamily(id))) ?? [],
);

/** Each row's position in the list, counting from one. */
const rowOrderAtom = atom((get) => {
  const at = new Map<PublicationId, number>();

  (get(publicationIdsAtom) ?? []).forEach((id, index) => at.set(id, index + 1));

  return at;
});

/**
 * A row's position in the list, counting from one, or 0 for a row that is not
 * in it.
 *
 * The number comes from the order, because a key does not encode a position
 * and an unsaved row's key is a UUID. It is read from `rowOrderAtom`, one map
 * of every row's position, because searching the list once per row would be
 * slow when every row asks at the same time.
 */
const rowNumberFamily = atomFamily((id: PublicationId) =>
  atom<number>((get) => get(rowOrderAtom).get(id) ?? 0),
);
const validCountAtom = atom((get) => get(validIdsAtom)?.length || 0);

// The rows that resemble something, in the order they are shown.
const resemblingIdsAtom = atom((get) =>
  get(publicationIdsAtom)?.filter((id) => get(resemblanceFamily(id))),
);

const resemblingCountAtom = atom((get) => get(resemblingIdsAtom)?.length || 0);

/**
 * Which row the resemblance review is open on. It holds a row id to open on
 * `startAt`, or at the start of the queue when `startAt` is not given. It is
 * null when the review is closed.
 *
 * It is kept in the store because two controls open the review: the
 * resemblance counter and the look-alike button on each row. `resetAll` resets
 * it, which closes the review when the working set is cleared.
 */
const reviewingAtom = atomWithReset<{ startAt?: PublicationId } | null>(null);

/**
 * The fields the look-alike check reads. The title, the translators, the
 * original title and the original authors must be alike, and the year, the
 * countries and the publishers must not conflict. The backend rule is in
 * `Publication.Duplicates`.
 *
 * `rowSubjectFamily` builds a row's subject from these fields. The subject
 * decides both when `watchChecks` runs the check again and when a stored
 * result stops applying. Both use this one list. If a field made a result stop
 * applying without running the check again, the row would have no result until
 * some other edit ran the check.
 */
const RESEMBLANCE_ATTRIBUTES: PublicationKey[] = [
  "title",
  "authors",
  "originalTitle",
  "originalAuthors",
  "year",
  "countries",
  "publishers",
];

/**
 * A row's subject: the fields in `RESEMBLANCE_ATTRIBUTES` as one string. List
 * fields are joined with spaces, and the fields are joined with a NUL
 * character.
 *
 * When a row's subject changes, its last look-alike check result no longer
 * describes it.
 */
const rowSubjectFamily = atomFamily((id: PublicationId) =>
  atom((get) => {
    const publication = get(publicationFamily(id));

    return RESEMBLANCE_ATTRIBUTES.map((attribute) =>
      [publication?.[attribute]].flat().join(" "),
    ).join("\u0000");
  }),
);

/**
 * The key of a row's subject, as stored with a look-alike check result. It is
 * a hash, so a stored result does not carry the whole subject.
 */
const rowSubjectKeyFamily = atomFamily((id: PublicationId) =>
  atom((get) => hash(get(rowSubjectFamily(id)))),
);

/**
 * What the row resembles. Returns `null` when the row resembles nothing, or
 * when the stored result was checked against a subject the row no longer has.
 *
 * It is kept apart from `errorFamily` because a resemblance is not an error. It
 * does not make a row invalid and it does not block a submit, except when the
 * row repeats an earlier row's key (see `rowErrorFamily`).
 *
 * The atom compares the stored subject with the current one each time it is
 * read, so no edit path has to clear the result. This covers edits made with
 * `setField` and edits from other people that replace the row in
 * `publicationFamily`.
 */
const resemblanceFamily = atomFamily((id: PublicationId) =>
  atom<Resemblance | null>((get) => {
    const measured = get(measuredResemblanceFamily(id));

    return measured && measured.at === get(rowSubjectKeyFamily(id))
      ? measured.value
      : null;
  }),
);

/**
 * What is wrong with a row: the validation error in `errorFamily`, or
 * `"repeated"` when the look-alike check found an earlier row with the same
 * composite key.
 *
 * A repeat is an error because the database stores one publication per key, so
 * a submit with both rows would be refused.
 */
const rowErrorFamily = atomFamily((id: PublicationId) =>
  atom<PublicationError>((get) => {
    const repeats = get(resemblanceFamily(id))?.repeats ?? null;

    return get(errorFamily(id)) ?? (repeats === null ? null : "repeated");
  }),
);

/**
 * The subjects of all rows, in order, as one JSON string.
 *
 * It changes only when a row's subject or the set of rows changes, so
 * editing a field outside `RESEMBLANCE_ATTRIBUTES`, such as the sources, leaves
 * it as it was. Being a string, an unchanged value compares equal and does not
 * notify the atom's subscribers.
 */
const resemblanceSubjectAtom = atom((get) =>
  JSON.stringify(
    (get(publicationIdsAtom) ?? []).map((id) => get(rowSubjectFamily(id))),
  ),
);

/** The number of rows in the list. */
const publicationCountAtom = atom(
  (get) => get(publicationIdsAtom)?.length || 0,
);

/**
 * The publication attributes that hold each kind of name, keyed by the kinds
 * the vocabulary routes use.
 *
 * Translators (`authors`) and original authors (`originalAuthors`) are one
 * kind, because the database stores both in one table. A person who translated
 * one book and wrote another is one name, so `replaceName` corrects it in both
 * attributes.
 */
const NAME_ATTRIBUTES = {
  authors: ["authors", "originalAuthors"],
  publishers: ["publishers"],
} as const satisfies Record<string, readonly PublicationKey[]>;

type NameKind = keyof typeof NAME_ATTRIBUTES;

/** One name the batch would enter, and the rows that carry it. */
type BatchName = { name: string; rows: PublicationId[] };

/**
 * Every name that the rows would enter, by kind, sorted alphabetically.
 *
 * Names are trimmed and blank names are dropped. A row that carries a name
 * twice is listed once in `rows`, so `rows` holds the publications that would
 * credit the name.
 */
const batchNamesAtom = atom((get) => {
  const ids = get(publicationIdsAtom) ?? [];

  const gather = (attributes: readonly PublicationKey[]): BatchName[] => {
    const rows = new Map<string, Set<PublicationId>>();

    for (const id of ids) {
      const publication = get(publicationFamily(id));

      for (const attribute of attributes) {
        for (const value of (publication?.[attribute] as string[]) ?? []) {
          const name = value.trim();
          if (name === "") continue;

          rows.set(name, (rows.get(name) ?? new Set()).add(id));
        }
      }
    }

    return [...rows]
      .map(([name, on]) => ({ name, rows: [...on] }))
      .sort((one, other) => one.name.localeCompare(other.name));
  };

  return {
    authors: gather(NAME_ATTRIBUTES.authors),
    publishers: gather(NAME_ATTRIBUTES.publishers),
  };
});

const visibleAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => get(attributeVisibleFamily(key))),
);

const hiddenAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => !get(attributeVisibleFamily(key))),
);

// --- Derived families -------------------------------------------------------

/**
 * A row's sources, including unsaved edits, or an empty list when it has none.
 */
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

/** A publication's saved sources, ignoring unsaved edits, or an empty list when
 * it has none. */
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
  atom((get) => !get(rowErrorFamily(id))),
);

const errorCodeFamily = atomFamily((id: PublicationId) =>
  atom((get) => errorCode(get(rowErrorFamily(id)))),
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
 * A single cell's saved value, as the server last returned it, ignoring
 * unsaved edits. The read-only index reads this, because an editor open over
 * the index edits the same rows.
 */
const storedFieldValueFamily = cellFamily(({ id, key }) =>
  atom((get) => get(savedFamily(id))?.[key]),
);

const fieldErrorCodeFamily = cellFamily(({ id, key }) =>
  atom((get) => errorCode(get(rowErrorFamily(id)), key)),
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
  lastValidatedFamily,
  publicationSourcesFamily,
  publicationExcerptsFamily,
  storedSourcesFamily,
  isValidFamily,
  errorCodeFamily,
  measuredResemblanceFamily,
  resemblanceFamily,
  rowErrorFamily,
  rowSubjectFamily,
  rowSubjectKeyFamily,
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

/** The fields a person can edit. `isEdited` compares only these. */
const EDITED_FIELDS = [...ATTRIBUTES, "sources"] as const;

/**
 * Returns a publication's editable fields as JSON in a fixed order, so that two
 * copies can be compared as strings.
 */
function contentOf(publication: Publication): string {
  const complete = { ...empty(), ...publication };

  return JSON.stringify(EDITED_FIELDS.map((field) => complete[field]));
}

/**
 * Returns the key a validation result is stored with: a hash of the
 * publication's editable fields. Two copies with the same content have the
 * same key, whichever other fields they carry.
 */
function contentKey(publication: Publication): string {
  return hash(contentOf(publication));
}

/**
 * Returns whether a row has an edit the database does not have yet, meaning
 * its document copy differs from its saved copy in one of `EDITED_FIELDS`.
 * A row with no saved copy is never counted as edited.
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
 * Writes publications as the database returned them: each one's saved copy in
 * `savedFamily`, and its row in the document. Run it inside `Doc.hold`,
 * together with the matching change to the reading order.
 *
 * A row with an unsaved edit keeps the edit, and only its saved copy is
 * updated. Search results that arrive while an editor is open therefore do not
 * overwrite what is being typed.
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
 * publication seen this session. A row with an unsaved edit is kept but left
 * out of the reading order, so a search that runs while an editor is open does
 * not discard what is being typed.
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
 * Puts one saved publication in the store without adding it to the reading
 * order. It sets the saved copy and writes the row into the document,
 * replacing what the row held. It is the counterpart of `forget`.
 */
function remember(store: Store, publication: Publication): void {
  const { doc } = documentOf(store);

  store.set(savedFamily(publication.id!), publication);
  Doc.hold(doc, () => Doc.putRow(doc, publication.id!, publication));
}

/**
 * Take an index payload as the working set: the rows, their order, and how
 * many publications exist in total.
 *
 * One definition of "these are the results now", wherever they were read.
 */
function receiveIndex(
  store: Store,
  { entries, total, order, perPage }: PublicationIndex,
): PublicationId[] {
  if (total !== null) store.set(totalIndexCountAtom, total);
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

/**
 * Replaces the working set with `entries`, and stores each entry's errors as
 * its validation result.
 */
function setAll(store: Store, entries: PublicationEntry[]): void {
  const { doc, undo } = documentOf(store);

  Doc.setAll(doc, entries);
  undo.stopCapturing();
  setErrors(store, entries);

  // With no entries, the document may already be empty. `Doc.setAll` then
  // changes nothing and the observer does not run, so the order is set here.
  // With entries, the observer has already set it, and setting it again would
  // re-render the whole table.
  if (entries.length === 0) store.set(publicationIdsAtom, []);
}

/**
 * Stores the validation result of each entry: `errors`, found for the content
 * in `publication`.
 *
 * A row the store's document holds gets its result in the document, so
 * everyone who has an import document open reads it. Any other row, such as
 * the draft row, gets it in `errorFamily` only.
 */
function setErrors(store: Store, entries: PublicationEntry[]): void {
  const { doc } = documentOf(store);
  const held = entries.filter(({ id }) => Doc.holds(doc, id));

  entries
    .filter(({ id }) => !Doc.holds(doc, id))
    .forEach(({ id, errors }) => store.set(errorFamily(id), errors));

  if (held.length > 0) {
    Doc.putValidations(
      doc,
      held.map(
        ({ id, publication, errors }) =>
          [id, { content: contentKey(publication), errors }] as const,
      ),
    );
  }
}

/**
 * Stores the look-alike check result for each row in `ids` in the store's
 * document, with the key of the row's current subject, and records the
 * current subject of the rows as the one the check ran on. A row in
 * `ids` that is absent from `found` is reset to resemble nothing.
 */
function setResemblances(
  store: Store,
  ids: PublicationId[],
  found: Map<PublicationId, Resemblance>,
): void {
  const { doc } = documentOf(store);

  Doc.putResemblances(
    doc,
    ids.map((id) => {
      const value = found.get(id);

      return [
        id,
        value ? { at: store.get(rowSubjectKeyFamily(id)), value } : null,
      ] as const;
    }),
    hash(store.get(resemblanceSubjectAtom)),
  );
}

/**
 * Opens the resemblance review on row `startAt`, or at the start of the queue
 * when `startAt` is not given.
 */
function openReview(store: Store, startAt?: PublicationId): void {
  store.set(reviewingAtom, { startAt });
}

function closeReview(store: Store): void {
  store.set(reviewingAtom, RESET);
}

function setFocusedRowId(store: Store, id: PublicationId | undefined): void {
  store.set(focusedRowIdAtom, id);
}

/** Edits one field of a row. */
function setField<K extends PublicationKey>(
  store: Store,
  id: PublicationId,
  attribute: K,
  value: Publication[K],
): void {
  writeRow(store, id, { [attribute]: value });
}

/** Edits a row's whole sources list, which is edited as a unit rather than per
 * cell. */
function setSources(store: Store, id: PublicationId, sources: string[]): void {
  writeRow(store, id, { sources });
}

/**
 * Writes an edit to a row.
 *
 * Every row except the draft row is edited in the store's document, where the
 * edit replaces the field's value. The draft row is kept in its atom, so a row
 * nobody has added yet does not reach other people sharing an import document.
 * `addNew` moves it into the document.
 *
 * An edit to a row the document no longer holds, such as a row another person
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
 * Replaces the name `from` with `to` in the given rows, in the attributes of
 * `kind`.
 *
 * Rows that do not contain `from` are left unchanged. When an attribute would
 * then contain `to` twice, it keeps one copy.
 *
 * All the changes happen in one `Doc.write` transaction, so the document emits
 * one update for them, which is saved and relayed as one change. The
 * replacement is also a separate undo step from any edit made just before or
 * after it.
 */
function replaceName(
  store: Store,
  kind: NameKind,
  ids: PublicationId[],
  from: string,
  to: string,
): void {
  const { doc, undo } = documentOf(store);

  undo.stopCapturing();
  Doc.write(doc, () => {
    for (const id of ids) {
      const publication = store.get(publicationFamily(id));

      for (const attribute of NAME_ATTRIBUTES[kind]) {
        const values = publication?.[attribute] as string[] | undefined;
        if (!values?.includes(from)) continue;

        const written = values.map((value) => (value === from ? to : value));
        setField(store, id, attribute, [...new Set(written)]);
      }
    }
  });
  undo.stopCapturing();
}

/**
 * Cancels an edit: puts a row back to its saved copy and clears its errors. A
 * row with no saved copy keeps its current values.
 */
function discardEdit(store: Store, id: PublicationId): void {
  const saved = store.get(savedFamily(id));
  const { doc } = documentOf(store);

  if (saved) remember(store, saved);
  Doc.putValidations(doc, [[id, null]]);
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
  // Adding a row and typing into it are separate undo steps.
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

  // All copies are added in one transaction. The observer then rebuilds the
  // lists once, the copies are saved and relayed as one update, and one undo
  // removes them all.
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
 * A document the store created is unbound and discarded, and the next write
 * creates a new one. A document from `openWorkspace` is left unchanged.
 * Emptying it would be an edit that everyone sharing it sees, and `setAll`
 * replaces its rows in one step when the store is filled again.
 */
function resetAll(store: Store): void {
  knownIds().forEach((id) => {
    store.set(publicationFamily(id), RESET);
    store.set(savedFamily(id), RESET);
    store.set(errorFamily(id), RESET);
    store.set(lastValidatedFamily(id), RESET);
    store.set(measuredResemblanceFamily(id), RESET);
  });

  store.set(publicationIdsAtom, RESET);
  store.set(focusedRowIdAtom, RESET);
  // Closes the resemblance review, since the rows it shows are gone.
  store.set(reviewingAtom, RESET);

  const binding = documents.get(store);

  if (binding?.owned) {
    binding.stop();
    documents.delete(store);
  }
}

/**
 * Removes the rows `ids` from the store's document, with their check results,
 * because they were moved to another document. It also forgets the content
 * this client last validated for them.
 *
 * The removal is saved and relayed like an edit, but undo does not bring the
 * rows back, because they are in the other document now (see `Doc.MOVED`).
 */
function moveOut(store: Store, ids: PublicationId[]): void {
  Doc.moveOut(documentOf(store).doc, ids);

  ids.forEach((id) => store.set(lastValidatedFamily(id), RESET));
}

/**
 * Drop a publication that no longer exists on the server (after a server-side
 * delete): remove its id from the index and reset its per-row state.
 */
function removePublication(store: Store, id: PublicationId): void {
  const { doc, undo } = documentOf(store);

  Doc.removeRow(doc, id);
  undo.stopCapturing();

  store.set(publicationFamily(id), RESET);
  store.set(savedFamily(id), RESET);
  store.set(errorFamily(id), RESET);
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
  const ids = store.get(publicationIdsAtom);
  if (!ids) return;

  const isInvalid = (id: PublicationId) => store.get(rowErrorFamily(id));
  const focusedId = store.get(focusedRowIdAtom);
  // Walk by list position (ids are no longer monotonic once rows are keyed by
  // server id), then wrap to the first invalid row.
  const start = focusedId === undefined ? -1 : ids.indexOf(focusedId);
  const nextInvalidId =
    ids.slice(start + 1).find(isInvalid) ?? ids.find(isInvalid);

  store.set(focusedRowIdAtom, nextInvalidId);
}

export {
  RESEMBLANCE_ATTRIBUTES,
  addNew,
  appendIndex,
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  batchNamesAtom,
  closeReview,
  contentKey,
  createId,
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
  matchingCountAtom,
  openReview,
  openWorkspace,
  orderAtom,
  perPageAtom,
  publicationExcerptsFamily,
  publicationFamily,
  publicationCountAtom,
  publicationIdsAtom,
  publicationSourcesFamily,
  receiveIndex,
  moveOut,
  remember,
  removePublication,
  replaceName,
  resemblanceFamily,
  rowErrorFamily,
  resemblanceSubjectAtom,
  resemblingCountAtom,
  resemblingIdsAtom,
  resetAll,
  resetAttributes,
  reviewingAtom,
  rowNumberFamily,
  rowSubjectFamily,
  rowSubjectKeyFamily,
  savedFamily,
  setAll,
  setAttributesVisible,
  setErrors,
  setField,
  setFocusedRowId,
  setResemblances,
  setSources,
  storedFieldValueFamily,
  storedSourcesFamily,
  totalIndexCountAtom,
  unsourcedCountAtom,
  validCountAtom,
  visibleAttributesAtom,
};
export type { BatchName, NameKind, PublicationIndex };

import { v4 as uuid } from "uuid";
import { Atom, atom } from "jotai";
import { atomFamily } from "jotai-family";
import { RESET, atomWithReset } from "jotai/utils";
import { isEqual } from "lodash";
import type { RichTextValue } from "modules/rich-text";
import type { Store } from "modules/store";
import * as Y from "yjs";
import * as Doc from "./doc";
import {
  ATTRIBUTES,
  DEFAULT_ATTRIBUTE_VISIBILITY,
  ErrorScope,
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
 * Returns a short key for `text`: its 53-bit cyrb53 hash, written in base 36.
 *
 * Two different texts get the same key with negligible probability, so a key
 * stored with a check result stands for the text the check read. The hash is
 * not cryptographic. It is computed in one pass over the text, which keeps it
 * cheap enough to run on every edit of every row.
 */
function digest(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
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
      writeValidationsAtom,
      changed.map((id) => [id, Doc.validationOf(doc, id)] as const),
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

/**
 * How many publications the database holds, as the index last reported, or
 * null before any report.
 */
const totalIndexCountAtom = atom<number | null>(null);

/**
 * The ordering a query answered with: the ids of every match, in the order they
 * are to be read. It is fixed when the query is first answered, so a record
 * inserted or removed afterwards does not shift which rows a later page holds.
 */
const orderAtom = atom<PublicationId[]>([]);

/**
 * How many publications answered the current query, across every page: the
 * length of its ordering.
 */
const matchingCountAtom = atom((get) => get(orderAtom).length);

/** How many a page holds, as the server counts them. */
const perPageAtom = atom<number>(0);

/**
 * How many positions of the ordering have been fetched. It advances by a
 * page's worth at a time, whatever number of rows came back, so a record
 * removed since the ordering was frozen is skipped rather than asked for again.
 */
const drawnCountAtom = atom<number>(0);

/**
 * Whether a further page is being fetched. Only one page is fetched at a time,
 * so a scroll that stays at the bottom does not ask for the same page twice.
 */
const isLoadingMoreAtom = atom<boolean>(false);

/**
 * The keys of the rows in the list, in reading order, as the store's document
 * holds them. It is undefined until the working set has loaded.
 */
const publicationIdsAtom = atomWithReset<PublicationId[] | undefined>(
  undefined,
);

/** Whether each row shows its number in the list. */
const areRowIdsVisibleAtom = atom(false);

/** The key of the row that holds the focus, or undefined when none does. */
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

/**
 * The content key (see `contentKey`) of the content this client last sent for
 * validation for each row, or undefined when it has sent none. A row whose
 * content has this key is not sent again.
 */
const lastValidatedFamily = atomFamily((_id: PublicationId) =>
  atomWithReset<string | undefined>(undefined),
);

/**
 * The content key (see `contentKey`) of the content each row's last validation
 * result was computed for, or undefined when the row has none. When the row's
 * content has changed since, the result no longer applies. See
 * `isCheckedFamily`.
 */
const checkedContentFamily = atomFamily((_id: PublicationId) =>
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

/** Whether each attribute's column is shown. */
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
 * Writes each `[id, validation]` pair into `errorFamily` and
 * `checkedContentFamily` in one store update, so the valid and checked rows are
 * recomputed once. A `null` validation clears both.
 */
const writeValidationsAtom = atom(
  null,
  (_get, set, entries: (readonly [PublicationId, Doc.Validation | null])[]) =>
    entries.forEach(([id, validation]) => {
      set(errorFamily(id), validation?.errors ?? null);
      set(checkedContentFamily(id), validation?.content);
    }),
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

/** The rows nothing is wrong with, in the order they are shown. */
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

/** The number of rows nothing is wrong with. */
const validCountAtom = atom((get) => get(validIdsAtom)?.length || 0);

/** The rows that resemble something, in the order they are shown. */
const resemblingIdsAtom = atom((get) =>
  get(publicationIdsAtom)?.filter((id) => get(resemblanceFamily(id))),
);

/** The number of rows that resemble something. */
const resemblingCountAtom = atom((get) => get(resemblingIdsAtom)?.length || 0);

/**
 * Which row the resemblance review is open on. It holds a row id to open on
 * `startAt`, or at the start of the queue when `startAt` is not given. It is
 * null when the review is closed.
 *
 * It is kept in the store rather than in a component, so that more than one
 * control can open the review. `resetAll` resets it, which closes the review
 * when the working set is cleared.
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
 * The key of a row's subject (see `digest`), as stored with a look-alike check
 * result, so a stored result does not carry the whole subject.
 */
const rowSubjectKeyFamily = atomFamily((id: PublicationId) =>
  atom((get) => digest(get(rowSubjectFamily(id)))),
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
 * The key of the subjects of all rows, in order: the digest of every row's
 * subject key. It is stored with the look-alike check results, and a check is
 * due when it differs from the stored one.
 *
 * It changes only when a row's subject or the list of rows changes, so editing
 * a field outside `RESEMBLANCE_ATTRIBUTES`, such as the sources, leaves it as
 * it was. Being a string, an unchanged value compares equal and does not
 * notify the atom's subscribers. An edit recomputes the key of the edited row
 * only, since every other row's key is cached in `rowSubjectKeyFamily`.
 */
const resemblanceSubjectKeyAtom = atom((get) =>
  digest(
    (get(publicationIdsAtom) ?? [])
      .map((id) => get(rowSubjectKeyFamily(id)))
      .join(" "),
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

/** The attributes whose columns are shown, in the order of `ATTRIBUTES`. */
const visibleAttributesAtom = atom((get) =>
  ATTRIBUTES.filter((key) => get(attributeVisibleFamily(key))),
);

/** The attributes whose columns are hidden, in the order of `ATTRIBUTES`. */
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

/**
 * A row's notes as a rich-text value, including unsaved edits, or null when it
 * has none or its record was read from a page of the index.
 */
const publicationNotesFamily = atomFamily((id: PublicationId) =>
  atom<RichTextValue | null>(
    (get) => get(publicationFamily(id))?.notes ?? null,
  ),
);

/**
 * The matching text of each of a publication's fields, with the matched words
 * wrapped in `[[ ]]`. It is undefined outside a search, and null for any field
 * the search did not match.
 */
const publicationExcerptsFamily = atomFamily((id: PublicationId) =>
  atom<Record<string, string | null> | undefined>(
    (get) => get(savedFamily(id))?.excerpts,
  ),
);

/**
 * A publication's saved sources, ignoring unsaved edits, or an empty list when
 * it has none.
 */
const storedSourcesFamily = atomFamily((id: PublicationId) =>
  atom<string[]>((get) => get(savedFamily(id))?.sources ?? []),
);

/**
 * How many rows in the list have no saved sources. A row whose sources are
 * typed but not saved still counts.
 */
const unsourcedCountAtom = atom(
  (get) =>
    get(publicationIdsAtom)?.filter(
      (id) => get(storedSourcesFamily(id)).length === 0,
    ).length || 0,
);

/** Whether nothing is wrong with each row (see `rowErrorFamily`). */
const isValidFamily = atomFamily((id: PublicationId) =>
  atom((get) => !get(rowErrorFamily(id))),
);

/** The content key (see `contentKey`) of each row's current content. */
const rowContentKeyFamily = atomFamily((id: PublicationId) =>
  atom((get) => contentKey(get(publicationFamily(id)))),
);

/**
 * Whether each row has a validation result for its current content. A row
 * edited since its last result, or never validated, is unchecked, because its
 * stored errors describe content it no longer has.
 */
const isCheckedFamily = atomFamily((id: PublicationId) =>
  atom((get) => get(checkedContentFamily(id)) === get(rowContentKeyFamily(id))),
);

/**
 * How many rows have no validation result for their current content. A row
 * whose stored result still matches its content counts as checked, even while
 * a new validation of it is in flight.
 */
const uncheckedCountAtom = atom(
  (get) =>
    (get(publicationIdsAtom) ?? []).filter((id) => !get(isCheckedFamily(id)))
      .length,
);

/** The code of what is wrong with each row as a whole (see `errorCode`). */
const errorCodeFamily = atomFamily((id: PublicationId) =>
  atom((get) => errorCode(get(rowErrorFamily(id)))),
);

/**
 * Which cell an atom belongs to: the publication, and the field of it, an
 * attribute or the notes.
 */
type FieldKey = { id: PublicationId; key: ErrorScope };

/** A cell written as one string, `<id>:<field>`. */
type CellKey = `${PublicationId}:${ErrorScope}`;

/** Returns the string a cell is cached under. */
const cellKey = ({ id, key }: FieldKey): CellKey => `${id}:${key}`;

/** Reads a cell back from the string `cellKey` wrote. */
const fieldKey = (cell: CellKey): FieldKey => {
  const separator = cell.indexOf(":");

  return {
    id: idFromText(cell.slice(0, separator)),
    key: cell.slice(separator + 1) as ErrorScope,
  };
};

/**
 * Returns an atom family for cells that is called with `{ id, key }` and caches
 * each cell's atom under the string `cellKey` writes. `forget(ids)` removes the
 * cached atoms of every cell of those rows.
 *
 * `atomFamily` only takes its `Map.get` fast path when no custom comparator is
 * passed; give it one and it linear-scans the whole cache on every lookup. These
 * caches hold an entry per cell (ids × attributes) and are read on every cell
 * render, so an object key made lookup cost grow with the size of the index.
 */
function cellFamily<T>(initialize: (field: FieldKey) => Atom<T>) {
  const family = atomFamily((cell: CellKey) => initialize(fieldKey(cell)));
  const read = (field: FieldKey) => family(cellKey(field));

  // The keys are copied before any is removed, because `getParams` iterates
  // the live cache. One pass covers the whole batch, since a search can drop as
  // many rows as it keeps.
  read.forget = (ids: Set<PublicationId>) =>
    [...family.getParams()]
      .filter((cell) => ids.has(fieldKey(cell).id))
      .forEach((cell) => family.remove(cell));

  return read;
}

/**
 * A single cell's value. Each cell has its own atom, so editing one cell
 * re-renders only that cell.
 */
const fieldValueFamily = cellFamily(({ id, key }) =>
  atom((get) => get(publicationFamily(id))?.[key]),
);

/**
 * The code of what is wrong with a single cell's field, an attribute or the
 * notes (see `errorCode`).
 */
const fieldErrorCodeFamily = cellFamily(({ id, key }) =>
  atom((get) => errorCode(get(rowErrorFamily(id)), key)),
);

// --- Family lifecycle -------------------------------------------------------

/**
 * Every family keyed by a row key. A family caches one atom per key for the
 * life of the module, so `forget` removes the keys of rows that leave the
 * working set. Otherwise every search would add the atoms of its results to the
 * cache for good.
 */
const PUBLICATION_FAMILIES = [
  publicationFamily,
  savedFamily,
  errorFamily,
  lastValidatedFamily,
  checkedContentFamily,
  rowContentKeyFamily,
  isCheckedFamily,
  publicationSourcesFamily,
  publicationNotesFamily,
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

/** Every family keyed by a cell. */
const CELL_FAMILIES = [fieldValueFamily, fieldErrorCodeFamily];

/**
 * A page of the database: the rows, what the search matched, and how many
 * publications exist in total, which the index reports in a header rather than
 * in the body.
 */
type PublicationIndex = {
  entries: Publication[];
  /** The words the search matched with something other than what was typed. */
  matched: Matched[];
  /** How many exist in total, not how many matched. `null` when unreported. */
  total: number | null;
  /**
   * The ids of every match, in reading order. The order is fixed when the
   * query is answered, and later pages are read from it.
   */
  order: PublicationId[];
  /** How many a page holds, as the server counts them. */
  perPage: number;
};

/** Removes the cached atoms of these rows from every family, cells included. */
function forget(ids: Iterable<PublicationId>): void {
  const dropped = new Set(ids);

  dropped.forEach((id) =>
    PUBLICATION_FAMILIES.forEach((family) => family.remove(id)),
  );
  CELL_FAMILIES.forEach((family) => family.forget(dropped));
}

/**
 * Returns every row key any family holds an atom for, including keys that were
 * never in `publicationIdsAtom`, such as a row a spec set directly.
 */
function knownIds(): Set<PublicationId> {
  return new Set(
    PUBLICATION_FAMILIES.flatMap((family) => [...family.getParams()]),
  );
}

// --- Actions (each writes the store it is given) ----------------------------

/**
 * Runs `change` on the store's document as one edit of this client, and makes
 * that edit one undo step of its own. `change` receives the document and runs
 * in one transaction with the origin `LOCAL`, so the document emits one update
 * for it.
 *
 * Yjs merges edits made close together in time into one undo step. `step`
 * stops that merge before and after `change`, so an undo reverts the action and
 * nothing typed just before or after it.
 */
function step<T>(store: Store, change: (doc: Y.Doc) => T): T {
  const { doc, undo } = documentOf(store);

  undo.stopCapturing();
  const result = Doc.write(doc, () => change(doc));
  undo.stopCapturing();

  return result;
}

/** The fields a person can edit. `isEdited` compares only these. */
const EDITED_FIELDS = [...ATTRIBUTES, "sources", "notes"] as const;

/**
 * Returns the values of a publication's editable fields, in the order of
 * `EDITED_FIELDS`. A field the publication does not hold, such as the notes of
 * a record read from a page of the index, is null.
 */
function editedValues(publication: Publication): unknown[] {
  const complete = { ...empty(), ...publication };

  return EDITED_FIELDS.map((field) => complete[field] ?? null);
}

/**
 * Returns the key a validation result is stored with: the digest of the
 * publication's editable fields, written as JSON (see `editedValues`). Two
 * copies with the same content have the same key, whichever other fields they
 * carry. A row's current key is cached in `rowContentKeyFamily`.
 */
function contentKey(publication: Publication): string {
  return digest(JSON.stringify(editedValues(publication)));
}

/**
 * Returns whether a row has an edit the database does not have yet, meaning
 * its document copy differs from its saved copy in one of `EDITED_FIELDS`.
 * A row with no saved copy is never counted as edited.
 *
 * The fields are compared with lodash's `isEqual`, so notes whose objects list
 * their keys in another order, as JSON from the API may, are the same notes. A
 * field one copy does not hold equals a null in the other.
 */
function isEdited(store: Store, id: PublicationId): boolean {
  const saved = store.get(savedFamily(id));
  const row = store.get(publicationFamily(id));

  return (
    saved !== undefined &&
    row !== undefined &&
    !isEqual(editedValues(row), editedValues(saved))
  );
}

/**
 * Returns whether any row of the store has an edit the database does not have
 * yet (see `isEdited`).
 */
function hasUnsavedEdit(store: Store): boolean {
  return [...knownIds()].some((id) => isEdited(store, id));
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
 * Makes `publications`, as the backend saved them, the working set, keyed by
 * their server ids, and returns their ids.
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
  markLoadedWhenEmpty(store, ids.length);

  return ids;
}

/**
 * Sets the reading order to `[]` when `count` is 0, which marks the working set
 * as loaded with no rows.
 *
 * Writing an empty order to a document that is already empty changes nothing,
 * so the document's observer does not run, and the order would stay unset,
 * which reads as "not loaded yet". With rows, the observer has already set the
 * order, and setting it again would re-render the whole table.
 */
function markLoadedWhenEmpty(store: Store, count: number): void {
  if (count === 0) store.set(publicationIdsAtom, []);
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
 * Adds a further page of results after the rows already loaded. A row already
 * present is skipped, so a record that moves across the page boundary, as a
 * deletion between two reads makes it do, is not listed twice.
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
 * Replaces the working set with `entries`, as one undo step, and stores each
 * entry's errors as its validation result.
 */
function setAll(store: Store, entries: PublicationEntry[]): void {
  step(store, (doc) => Doc.setAll(doc, entries));
  setErrors(store, entries);
  markLoadedWhenEmpty(store, entries.length);
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
    .forEach(({ id, publication, errors }) => {
      store.set(errorFamily(id), errors);
      store.set(checkedContentFamily(id), contentKey(publication));
    });

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
    store.get(resemblanceSubjectKeyAtom),
  );
}

/**
 * Opens the resemblance review on row `startAt`, or at the start of the queue
 * when `startAt` is not given.
 */
function openReview(store: Store, startAt?: PublicationId): void {
  store.set(reviewingAtom, { startAt });
}

/** Closes the resemblance review. */
function closeReview(store: Store): void {
  store.set(reviewingAtom, RESET);
}

/** Records which row holds the focus, or that none does. */
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

/**
 * Edits a row's sources, which are edited as one list rather than one cell at
 * a time.
 */
function setSources(store: Store, id: PublicationId, sources: string[]): void {
  writeRow(store, id, { sources });
}

/** Edits a row's notes: a rich-text value, or null for none. */
function setNotes(
  store: Store,
  id: PublicationId,
  notes: RichTextValue | null,
): void {
  writeRow(store, id, { notes });
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
 * The replacement is one `step`: the document emits one update for it, which is
 * saved and relayed as one change, and one undo reverts it.
 */
function replaceName(
  store: Store,
  kind: NameKind,
  ids: PublicationId[],
  from: string,
  to: string,
): void {
  step(store, () => {
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

/** Shows the columns of `keys`, or hides them when `isVisible` is false. */
function setAttributesVisible(
  store: Store,
  keys: PublicationKey[],
  isVisible = true,
): void {
  keys.forEach((key) => store.set(attributeVisibleFamily(key), isVisible));
}

/**
 * Adds the draft row to the end of the list as a new row, as one undo step, so
 * typing into the new row afterwards is a step of its own. Empties the draft
 * row, and returns the new row's key. Throws when the working set has not
 * loaded.
 */
function addNew(store: Store): PublicationId {
  const ids = store.get(publicationIdsAtom);
  if (!ids) throw "Can not add new publications: entries not loaded.";

  const id = createId();

  step(store, (doc) =>
    Doc.addRow(doc, id, store.get(publicationFamily(DRAFT_ID))),
  );
  store.set(publicationFamily(DRAFT_ID), empty());

  return id;
}

/**
 * Copies each row in `duplicateIds` and inserts the copy right after it, all as
 * one undo step. Returns the copies' keys. Throws when the working set has not
 * loaded.
 */
function duplicate(
  store: Store,
  duplicateIds: Set<PublicationId>,
): PublicationId[] {
  const ids = store.get(publicationIdsAtom);
  if (!ids) throw "Can not duplicate publications: entries not loaded.";

  const copies = new Map(
    ids.filter((id) => duplicateIds.has(id)).map((id) => [id, createId()]),
  );

  // One transaction for every copy, so the observer rebuilds the lists once.
  step(store, (doc) =>
    copies.forEach((copy, source) =>
      Doc.addRowAfter(doc, source, copy, store.get(publicationFamily(source))),
    ),
  );

  return [...copies.values()];
}

/**
 * Empties a store, and leaves every other store as it is.
 *
 * It resets the store's values for every key the families know (see
 * `knownIds`), not only the keys in the list, so a value set directly is reset
 * too. It does not remove the families' cached atoms, which every store shares,
 * since another surface may be reading the same keys. `hydrate` removes them
 * for the store it fills.
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
 * Adds `entries` after the rows already in the store's document, as one edit
 * of this client, so one undo takes them all out again. Each entry's
 * validation result is stored with it.
 */
function append(store: Store, entries: PublicationEntry[]): void {
  step(store, (doc) => Doc.appendRows(doc, entries));
  setErrors(store, entries);
}

/**
 * Removes the rows `ids` from the store's document, for everyone in it, as one
 * edit of this client, so one undo brings them all back. Their check results
 * are removed too, and this client forgets the content it last validated for
 * them, so a row brought back by undo is validated again.
 */
function remove(store: Store, ids: Set<PublicationId>): void {
  step(store, (doc) => Doc.removeRows(doc, [...ids]));
  ids.forEach((id) => store.set(lastValidatedFamily(id), RESET));
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
 * Removes a publication that the server no longer holds, such as one just
 * deleted, from the list as one undo step, and resets its per-row state. The
 * total count goes down by one, so it stays right without another read.
 */
function removePublication(store: Store, id: PublicationId): void {
  step(store, (doc) => Doc.removeRow(doc, id));

  store.set(publicationFamily(id), RESET);
  store.set(savedFamily(id), RESET);
  store.set(errorFamily(id), RESET);
  store.set(lastValidatedFamily(id), RESET);

  const total = store.get(totalIndexCountAtom);
  if (total !== null) {
    store.set(totalIndexCountAtom, total - 1);
  }
}

/** Shows and hides the columns as `DEFAULT_ATTRIBUTE_VISIBILITY` says. */
function resetAttributes(store: Store): void {
  ATTRIBUTES.forEach((key) => store.set(attributeVisibleFamily(key), RESET));
}

export {
  RESEMBLANCE_ATTRIBUTES,
  addNew,
  append,
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
  forget,
  hasUnsavedEdit,
  hiddenAttributesAtom,
  hydrate,
  invalidIdsAtom,
  isLoadingMoreAtom,
  isCheckedFamily,
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
  publicationNotesFamily,
  receiveIndex,
  moveOut,
  remove,
  remember,
  removePublication,
  replaceName,
  resemblanceFamily,
  rowErrorFamily,
  resemblanceSubjectKeyAtom,
  resemblingCountAtom,
  resemblingIdsAtom,
  resetAll,
  resetAttributes,
  reviewingAtom,
  rowContentKeyFamily,
  rowNumberFamily,
  rowSubjectKeyFamily,
  savedFamily,
  setAll,
  setAttributesVisible,
  setNotes,
  setErrors,
  setField,
  setFocusedRowId,
  setResemblances,
  setSources,
  storedSourcesFamily,
  totalIndexCountAtom,
  unsourcedCountAtom,
  uncheckedCountAtom,
  validCountAtom,
  visibleAttributesAtom,
};
export type { BatchName, NameKind, PublicationIndex };

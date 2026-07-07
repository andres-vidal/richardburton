import { atom } from "jotai";
import { RESET, atomFamily, atomWithReset } from "jotai/utils";
import { store } from "modules/store";
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
 * Well-known id for the always-present "new publication" draft row. Real
 * publications get stable ids from `createId()` (>= 1), so `0` never collides.
 */
const DRAFT_ID: PublicationId = 0;

let sequence = 1;
/** Mint a fresh, stable client id — decoupled from a publication's list position. */
function createId(): PublicationId {
  return sequence++;
}

// --- Base atoms -------------------------------------------------------------

const totalIndexCountAtom = atom<number | null>(null);
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

const deletedFamily = atomFamily((_id: PublicationId) =>
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
  get(publicationIdsAtom)?.filter((id) => !get(deletedFamily(id))),
);

const deletedIdsAtom = atom((get) =>
  get(publicationIdsAtom)?.filter((id) => get(deletedFamily(id))),
);

const overriddenIdsAtom = atom((get) =>
  get(visibleIdsAtom)?.filter((id) => get(overrideFamily(id))),
);

const validIdsAtom = atom((get) =>
  get(publicationIdsAtom)
    ?.filter((id) => !get(deletedFamily(id)))
    .filter((id) => !get(errorFamily(id))),
);

const visibleCountAtom = atom((get) => get(visibleIdsAtom)?.length || 0);
const deletedCountAtom = atom((get) => get(deletedIdsAtom)?.length || 0);
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

const isValidFamily = atomFamily((id: PublicationId) =>
  atom((get) => !get(errorFamily(id))),
);

const errorDescriptionFamily = atomFamily((id: PublicationId) =>
  atom((get) => describeError(get(errorFamily(id)))),
);

type FieldKey = { id: PublicationId; key: PublicationKey };
const sameField = (a: FieldKey, b: FieldKey) =>
  a.id === b.id && a.key === b.key;

/** A single cell's value — its own subscription, so editing one cell is cheap. */
const fieldValueFamily = atomFamily(
  ({ id, key }: FieldKey) =>
    atom((get) => get(visiblePublicationFamily(id))[key]),
  sameField,
);

const fieldErrorDescriptionFamily = atomFamily(
  ({ id, key }: FieldKey) =>
    atom((get) => describeError(get(errorFamily(id)), key)),
  sameField,
);

// --- Actions (imperative; operate on the module `store`) --------------------

function setAll(entries: PublicationEntry[]): void {
  store.set(
    publicationIdsAtom,
    entries.map(({ id }) => id),
  );
  entries.forEach(({ id, publication, errors }) => {
    store.set(publicationFamily(id), publication);
    store.set(errorFamily(id), errors);
  });
}

function setPublications(entries: PublicationEntry[]): void {
  store.set(
    publicationIdsAtom,
    entries.map(({ id }) => id),
  );
  entries.forEach(({ id, publication }) => {
    store.set(publicationFamily(id), publication);
  });
}

function setErrors(entries: PublicationEntry[]): void {
  entries.forEach(({ id, errors }) => store.set(errorFamily(id), errors));
}

function setDeleted(ids: PublicationId[], isDeleted = true): void {
  ids.forEach((id) => store.set(deletedFamily(id), isDeleted));
}

function setFocusedRowId(id: PublicationId | undefined): void {
  store.set(focusedRowIdAtom, id);
}

function overrideField(
  id: PublicationId,
  attribute: PublicationKey,
  value: string,
): void {
  const current = store.get(overrideFamily(id));
  store.set(overrideFamily(id), { ...current, [attribute]: value });
}

function setAttributesVisible(keys: PublicationKey[], isVisible = true): void {
  keys.forEach((key) => store.set(attributeVisibleFamily(key), isVisible));
}

/** Register the draft row as a new publication and clear the draft. */
function addNew(): PublicationId {
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
function duplicate(duplicateIds: Set<PublicationId>): PublicationId[] {
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

function resetAll(): void {
  store.get(publicationIdsAtom)?.forEach((id) => {
    store.set(publicationFamily(id), RESET);
    store.set(overrideFamily(id), RESET);
    store.set(errorFamily(id), RESET);
    store.set(deletedFamily(id), RESET);
  });
  store.set(publicationIdsAtom, RESET);
  store.set(focusedRowIdAtom, RESET);
}

function resetDeleted(): void {
  store
    .get(deletedIdsAtom)
    ?.forEach((id) => store.set(deletedFamily(id), RESET));
}

function resetOverridden(): void {
  store
    .get(publicationIdsAtom)
    ?.forEach((id) => store.set(overrideFamily(id), RESET));
}

function resetAttributes(): void {
  ATTRIBUTES.forEach((key) => store.set(attributeVisibleFamily(key), RESET));
}

/** Focus the next invalid row after the currently focused one (wrapping). */
function focusNextInvalid(): void {
  const visibleIds = store.get(visibleIdsAtom);
  if (!visibleIds) return;

  const focusedId = store.get(focusedRowIdAtom) ?? -1;
  const nextInvalidId =
    visibleIds.find((id) => id > focusedId && store.get(errorFamily(id))) ||
    visibleIds.find((id) => store.get(errorFamily(id)));

  store.set(focusedRowIdAtom, nextInvalidId);
}

export {
  DRAFT_ID,
  addNew,
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  createId,
  deletedCountAtom,
  duplicate,
  errorDescriptionFamily,
  errorFamily,
  fieldErrorDescriptionFamily,
  fieldValueFamily,
  focusNextInvalid,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  isValidFamily,
  isValidatingAtom,
  keywordsAtom,
  lastValidatedFamily,
  overrideField,
  overrideFamily,
  overriddenCountAtom,
  overriddenIdsAtom,
  publicationFamily,
  publicationIdsAtom,
  publicationOrNullFamily,
  resetAll,
  resetAttributes,
  resetDeleted,
  resetOverridden,
  setAll,
  setAttributesVisible,
  setDeleted,
  setErrors,
  setFocusedRowId,
  setPublications,
  store,
  totalCountAtom,
  totalIndexCountAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleIdsAtom,
  visiblePublicationFamily,
  visibleCountAtom,
};

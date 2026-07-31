import { createStore } from "jotai";
import { RESET } from "jotai/utils";

import {
  PublicationEntry,
  PublicationError,
  PublicationKey,
  empty,
} from "./model";
import {
  DRAFT_ID,
  addNew,
  appendIndex,
  createId,
  discardedCountAtom,
  discardEdit,
  duplicate,
  fieldValueFamily,
  focusNextInvalid,
  forget,
  hydrate,
  knownIds,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  isValidFamily,
  overriddenCountAtom,
  overriddenIdsAtom,
  overrideFamily,
  overrideField,
  publicationFamily,
  publicationIdsAtom,
  resetAll,
  resetAttributes,
  resetDiscarded,
  resetOverridden,
  setAll,
  setAttributesVisible,
  setDiscarded,
  setErrors,
  totalCountAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
  visiblePublicationFamily,
} from "./store";

import type { Store } from "modules/store";

// A store per test: publication state belongs to a workspace, so a spec makes
// its own rather than resetting one everybody shares.
let store: Store;

type Fields = Partial<ReturnType<typeof empty>>;

/** Build an entry with sensible defaults, mirroring what the remote layer emits. */
function entry(
  id: number,
  fields: Fields = {},
  errors: PublicationError = null,
): PublicationEntry {
  return { id, publication: { ...empty(), ...fields }, errors };
}

/** A field-level error map (the backend only returns the invalid fields). */
function fieldErrors(
  errors: Partial<Record<PublicationKey, string>>,
): PublicationError {
  return errors as Record<PublicationKey, string>;
}

beforeEach(() => {
  store = createStore();
  // The atom *caches* are still module-level, so ids from an earlier test are
  // reachable through the families even with a fresh store — clear them, and the
  // draft row with them (it is never in the id list).
  forget(knownIds());
  store.set(overrideFamily(DRAFT_ID), RESET);
});

describe("setAll", () => {
  test("registers the given ids and exposes them as visible", () => {
    const [a, b, c] = [createId(), createId(), createId()];
    setAll(store, [entry(a, { title: "Dom Casmurro" }), entry(b), entry(c)]);

    expect(store.get(publicationIdsAtom)).toEqual([a, b, c]);
    expect(store.get(visibleIdsAtom)).toEqual([a, b, c]);
    expect(store.get(totalCountAtom)).toBe(3);
    expect(store.get(visibleCountAtom)).toBe(3);
  });

  test("a cell reads its publication's field", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" })]);

    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro",
    );
  });

  test("a cell is cached by value, so it keeps one stable atom", () => {
    const a = createId();

    // Each call passes a fresh `{id, key}` object, so caching by identity would
    // mint a new atom every render — a new subscription per keystroke. Distinct
    // cells must still get distinct atoms.
    expect(fieldValueFamily({ id: a, key: "title" })).toBe(
      fieldValueFamily({ id: a, key: "title" }),
    );
    expect(fieldValueFamily({ id: a, key: "title" })).not.toBe(
      fieldValueFamily({ id: a, key: "authors" }),
    );
  });

  test("a cell key survives the negative ids minted for unsaved rows", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" })]);

    // Ids are packed into a `<id>:<key>` string; a negative id carries its own
    // "-", so splitting on the wrong separator would misread the id.
    expect(a).toBeLessThan(0);
    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro",
    );
  });
});

describe("validity", () => {
  test("only error-free rows count as valid", () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [entry(a), entry(b, {}, "conflict")]);

    expect(store.get(validCountAtom)).toBe(1);
    expect(store.get(isValidFamily(a))).toBe(true);
    expect(store.get(isValidFamily(b))).toBe(false);
  });

  test("setErrors flips a loaded row to invalid", () => {
    const a = createId();
    setAll(store, [entry(a)]);
    expect(store.get(validCountAtom)).toBe(1);

    setErrors(store, [entry(a, {}, fieldErrors({ title: "required" }))]);

    expect(store.get(isValidFamily(a))).toBe(false);
    expect(store.get(validCountAtom)).toBe(0);
  });
});

describe("deletion", () => {
  test("setDiscarded hides a row without dropping it from the list", () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [entry(a), entry(b)]);

    setDiscarded(store, [a]);

    expect(store.get(visibleIdsAtom)).toEqual([b]);
    expect(store.get(visibleCountAtom)).toBe(1);
    expect(store.get(discardedCountAtom)).toBe(1);
    expect(store.get(totalCountAtom)).toBe(2);
  });

  test("a deleted row no longer counts as valid", () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [entry(a), entry(b)]);
    expect(store.get(validCountAtom)).toBe(2);

    setDiscarded(store, [a]);

    expect(store.get(validCountAtom)).toBe(1);
  });

  test("resetDiscarded brings hidden rows back", () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [entry(a), entry(b)]);
    setDiscarded(store, [a]);
    expect(store.get(visibleCountAtom)).toBe(1);

    resetDiscarded(store);

    expect(store.get(visibleIdsAtom)).toEqual([a, b]);
  });
});

describe("overrides", () => {
  test("overrideField layers an edit over the stored publication", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" })]);

    overrideField(store, a, "title", "Dom Casmurro (rev.)");

    // The merged (visible) value reflects the edit...
    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro (rev.)",
    );
    expect(store.get(visiblePublicationFamily(a)).title).toBe(
      "Dom Casmurro (rev.)",
    );
    // ...but the underlying publication stays as loaded...
    expect(store.get(publicationFamily(a)).title).toBe("Dom Casmurro");
    // ...and the row is now flagged as overridden.
    expect(store.get(overriddenIdsAtom)).toEqual([a]);
    expect(store.get(overriddenCountAtom)).toBe(1);
  });

  test("resetOverridden drops pending edits", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" })]);
    overrideField(store, a, "title", "changed");
    expect(store.get(overriddenCountAtom)).toBe(1);

    resetOverridden(store);

    expect(store.get(overriddenCountAtom)).toBe(0);
    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro",
    );
  });

  test("discardEdit drops one row's pending edits and errors", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" }, "conflict")]);
    overrideField(store, a, "title", "changed");
    expect(store.get(overriddenCountAtom)).toBe(1);
    expect(store.get(isValidFamily(a))).toBe(false);

    discardEdit(store, a);

    expect(store.get(overriddenCountAtom)).toBe(0);
    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro",
    );
    expect(store.get(isValidFamily(a))).toBe(true);
  });
});

describe("addNew", () => {
  test("commits the typed draft as a real row and clears the draft", () => {
    const a = createId();
    setAll(store, [entry(a)]);

    // Type into the always-present draft row, then commit it.
    overrideField(store, DRAFT_ID, "title", "A Hora da Estrela");
    const newId = addNew(store);

    expect(store.get(publicationIdsAtom)).toEqual([a, newId]);
    expect(store.get(publicationFamily(newId)).title).toBe("A Hora da Estrela");
    // The draft resets to empty, ready for the next entry.
    expect(store.get(visiblePublicationFamily(DRAFT_ID)).title).toBe("");
  });

  test("refuses to run before entries are loaded", () => {
    // beforeEach left the id list unset (RESET → undefined).
    expect(() => addNew(store)).toThrow();
  });
});

describe("duplicate", () => {
  test("inserts a copy immediately after each selected row", () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [
      entry(a, { title: "Dom Casmurro" }),
      entry(b, { title: "Grande Sertão" }),
    ]);

    const [copyId] = duplicate(store, new Set([a]));

    expect(store.get(publicationIdsAtom)).toEqual([a, copyId, b]);
    expect(store.get(publicationFamily(copyId)).title).toBe("Dom Casmurro");
  });
});

describe("attribute visibility", () => {
  test("hiding an attribute moves it from visible to hidden", () => {
    expect(store.get(visibleAttributesAtom)).toContain("year");

    setAttributesVisible(store, ["year"], false);

    expect(store.get(visibleAttributesAtom)).not.toContain("year");
    expect(store.get(hiddenAttributesAtom)).toContain("year");
  });

  test("resetAttributes restores default visibility", () => {
    setAttributesVisible(store, ["year"], false);

    resetAttributes(store);

    expect(store.get(visibleAttributesAtom)).toContain("year");
  });
});

describe("focusNextInvalid", () => {
  test("steps through invalid rows and wraps back to the first", () => {
    const [a, b, c, d] = [createId(), createId(), createId(), createId()];
    setAll(store, [
      entry(a),
      entry(b, {}, "conflict"),
      entry(c),
      entry(d, {}, "conflict"),
    ]);

    // Nothing focused yet → first invalid (b).
    focusNextInvalid(store);
    expect(store.get(focusedRowIdAtom)).toBe(b);

    // → next invalid after b (d).
    focusNextInvalid(store);
    expect(store.get(focusedRowIdAtom)).toBe(d);

    // → nothing invalid after d, so wrap around to b.
    focusNextInvalid(store);
    expect(store.get(focusedRowIdAtom)).toBe(b);
  });
});

describe("ids and the draft", () => {
  test("createId hands out unique, negative ids (never collide with server ids)", () => {
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(0);
  });

  test("the draft row starts empty", () => {
    expect(store.get(visiblePublicationFamily(DRAFT_ID))).toEqual(empty());
  });
});

describe("family lifecycle", () => {
  /** A saved publication, as the index returns them. */
  const saved = (id: number, title = `Title ${id}`) => ({
    ...empty(),
    id,
    title,
  });

  test("a load forgets the publications the previous one held", () => {
    hydrate(store, [saved(1), saved(2)]);
    expect([...knownIds()]).toEqual(expect.arrayContaining([1, 2]));

    // A disjoint second load — a different search, say.
    hydrate(store, [saved(3)]);

    // The families hold the current set and nothing else: an id that keeps its
    // atom keeps it for the whole session.
    expect([...knownIds()].filter((id) => id !== DRAFT_ID)).toEqual([3]);
  });

  test("a row with unsaved edits survives a load that drops it", () => {
    hydrate(store, [saved(1)]);
    overrideField(store, 1, "title", "Being typed");

    hydrate(store, [saved(2)]);

    // Dropping it would discard what the admin is in the middle of writing —
    // a search running behind an open editor must not do that.
    expect(store.get(overrideFamily(1))).toEqual({ title: "Being typed" });
  });

  test("forgetting a publication drops its per-cell atoms too", () => {
    hydrate(store, [saved(7, "Dom Casmurro")]);
    // Touch a cell so its atom is cached.
    store.get(fieldValueFamily({ id: 7, key: "title" }));

    forget([7]);

    expect([...knownIds()]).not.toContain(7);
    // The cache is rebuilt on demand, at the initial value rather than the old one.
    expect(
      store.get(fieldValueFamily({ id: 7, key: "title" })),
    ).toBeUndefined();
  });

  test("teardown reaches ids that were set directly, not just listed ones", () => {
    // The specs poke families with ids that never enter publicationIdsAtom.
    store.set(publicationFamily(99), saved(99, "Poked"));

    resetAll(store);

    expect(store.get(publicationFamily(99))).toBeUndefined();
  });

  test("one store emptying itself leaves another store's publications alone", () => {
    const other = createStore();
    hydrate(other, [saved(1, "Dom Casmurro")]);

    resetAll(store);

    expect(store.get(publicationFamily(1))).toBeUndefined();
    expect(other.get(publicationFamily(1))).toEqual(saved(1, "Dom Casmurro"));
    expect(other.get(publicationIdsAtom)).toEqual([1]);
  });
});

describe("appendIndex", () => {
  const saved = (id: number, title = `Title ${id}`) => ({
    ...empty(),
    id,
    title,
  });

  test("grows the working set, keeping the rows already loaded", () => {
    hydrate(store, [saved(1), saved(2)]);
    appendIndex(store, [saved(3, "C"), saved(4, "D")]);

    expect(store.get(publicationIdsAtom)).toEqual([1, 2, 3, 4]);
    expect(store.get(publicationFamily(3))?.title).toBe("C");
  });

  test("skips an id already loaded, so a record shifting across the boundary is not doubled", () => {
    hydrate(store, [saved(1), saved(2)]);
    appendIndex(store, [saved(2), saved(3)]);

    expect(store.get(publicationIdsAtom)).toEqual([1, 2, 3]);
  });

  test("appends onto an empty set", () => {
    appendIndex(store, [saved(1)]);
    expect(store.get(publicationIdsAtom)).toEqual([1]);
  });
});

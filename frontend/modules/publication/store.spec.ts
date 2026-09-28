import { createStore } from "jotai";

import {
  PublicationEntry,
  PublicationError,
  PublicationId,
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
  publicationFamily,
  publicationIdsAtom,
  resetAll,
  resetAttributes,
  resetDiscarded,
  savedFamily,
  setAll,
  setAttributesVisible,
  setDiscarded,
  setErrors,
  setField,
  storedFieldValueFamily,
  totalCountAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
} from "./store";

import type { Store } from "modules/store";

// A store per test: publication state belongs to a workspace, so a spec makes
// its own rather than resetting one everybody shares.
let store: Store;

type Fields = Partial<ReturnType<typeof empty>>;

/** Build an entry with sensible defaults, mirroring what the remote layer emits. */
function entry(
  id: PublicationId,
  fields: Fields = {},
  errors: PublicationError = null,
): PublicationEntry {
  return { id, publication: { ...empty(), ...fields }, errors };
}

/** A saved publication, as the index returns them. */
const saved = (id: number, title = `Title ${id}`) => ({
  ...empty(),
  id,
  title,
});

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

  test("a cell key survives every namespace a row key comes from", () => {
    const minted = createId();
    setAll(store, [
      // A row the server has written, a row being worked on, and the draft.
      entry(7, { title: "Dom Casmurro" }),
      entry(minted, { title: "Iracema" }),
      entry(DRAFT_ID, { title: "Barren Lives" }),
    ]);

    // A cell is cached under an `<id>:<key>` string, so the id has to survive
    // being written into one and read back out.
    expect(store.get(fieldValueFamily({ id: 7, key: "title" }))).toBe(
      "Dom Casmurro",
    );
    expect(store.get(fieldValueFamily({ id: minted, key: "title" }))).toBe(
      "Iracema",
    );
    expect(store.get(fieldValueFamily({ id: DRAFT_ID, key: "title" }))).toBe(
      "Barren Lives",
    );
  });

  test("forgetting a row reaches the cells of every kind of key", () => {
    const minted = createId();
    setAll(store, [entry(7, { title: "Dom Casmurro" }), entry(minted)]);

    // Read both, so each has a cell atom cached under its own string key.
    store.get(fieldValueFamily({ id: 7, key: "title" }));
    store.get(fieldValueFamily({ id: minted, key: "title" }));

    forget([7, minted]);

    // A cell key is text, and matching it back to the row it belongs to is what
    // decides whether the cell is dropped with the row or outlives it.
    expect(knownIds().has(7)).toBe(false);
    expect(knownIds().has(minted)).toBe(false);
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

describe("edits", () => {
  test("an edit changes the row and leaves its saved copy as it was", () => {
    hydrate(store, [saved(1, "Dom Casmurro")]);

    setField(store, 1, "title", "Dom Casmurro (rev.)");

    // Whatever edits the row reads the edit...
    expect(store.get(fieldValueFamily({ id: 1, key: "title" }))).toBe(
      "Dom Casmurro (rev.)",
    );
    // ...and whatever shows the database still reads what is saved.
    expect(store.get(storedFieldValueFamily({ id: 1, key: "title" }))).toBe(
      "Dom Casmurro",
    );
    expect(store.get(savedFamily(1))?.title).toBe("Dom Casmurro");
  });

  test("discardEdit puts a row back the way it was saved, and drops its errors", () => {
    hydrate(store, [saved(1, "Dom Casmurro")]);
    setErrors(store, [entry(1, {}, "conflict")]);
    setField(store, 1, "title", "changed");
    expect(store.get(isValidFamily(1))).toBe(false);

    discardEdit(store, 1);

    expect(store.get(fieldValueFamily({ id: 1, key: "title" }))).toBe(
      "Dom Casmurro",
    );
    expect(store.get(isValidFamily(1))).toBe(true);
  });

  test("a row that was never saved keeps its edit when it is discarded", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" })]);
    setField(store, a, "title", "Dom Casmurro (rev.)");

    discardEdit(store, a);

    // There is no saved copy to go back to, so there is nothing to put back.
    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro (rev.)",
    );
  });
});

describe("addNew", () => {
  test("commits the typed draft as a real row and clears the draft", () => {
    const a = createId();
    setAll(store, [entry(a)]);

    // Type into the always-present draft row, then commit it.
    setField(store, DRAFT_ID, "title", "A Hora da Estrela");
    const newId = addNew(store);

    expect(store.get(publicationIdsAtom)).toEqual([a, newId]);
    expect(store.get(publicationFamily(newId)).title).toBe("A Hora da Estrela");
    // The draft resets to empty, ready for the next entry.
    expect(store.get(publicationFamily(DRAFT_ID)).title).toBe("");
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
  test("createId hands out keys no other browser could mint", () => {
    const a = createId();
    const b = createId();

    expect(a).not.toBe(b);

    // A UUID rather than a counter: a counter restarts at the same value in
    // every browser, and two people entering a row would claim one key.
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Never a number, so a row key can never be read as a server id.
    expect(typeof a).toBe("string");
  });

  test("the draft row starts empty", () => {
    expect(store.get(publicationFamily(DRAFT_ID))).toEqual(empty());
  });
});

describe("family lifecycle", () => {
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
    setField(store, 1, "title", "Being typed");

    hydrate(store, [saved(2)]);

    // Dropping it would discard what the admin is in the middle of writing —
    // a search running behind an open editor must not do that. It is no longer
    // listed, though, since the load did not return it.
    expect(store.get(publicationFamily(1)).title).toBe("Being typed");
    expect(store.get(publicationIdsAtom)).toEqual([2]);
  });

  test("a row with unsaved edits keeps them when a load returns it again", () => {
    hydrate(store, [saved(1, "Dom Casmurro")]);
    setField(store, 1, "title", "Being typed");

    hydrate(store, [saved(1, "Dom Casmurro, as someone else saved it")]);

    // The edit stays in the row, and only the saved copy moves.
    expect(store.get(publicationFamily(1)).title).toBe("Being typed");
    expect(store.get(storedFieldValueFamily({ id: 1, key: "title" }))).toBe(
      "Dom Casmurro, as someone else saved it",
    );
  });

  test("a row without edits takes what a load returns", () => {
    hydrate(store, [saved(1, "Dom Casmurro")]);

    hydrate(store, [saved(1, "Dom Casmurro, as someone else saved it")]);

    expect(store.get(publicationFamily(1)).title).toBe(
      "Dom Casmurro, as someone else saved it",
    );
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

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
  discardEdit,
  duplicate,
  fieldValueFamily,
  focusNextInvalid,
  forget,
  hydrate,
  knownIds,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  invalidIdsAtom,
  isValidFamily,
  publicationFamily,
  publicationIdsAtom,
  resemblanceFamily,
  resetAll,
  resetAttributes,
  rowErrorFamily,
  savedFamily,
  setAll,
  setAttributesVisible,
  setErrors,
  setField,
  setResemblances,
  setSources,
  storedFieldValueFamily,
  validCountAtom,
  visibleAttributesAtom,
  documentOf,
  errorFamily,
  moveOut,
  publicationCountAtom,
  receiveIndex,
  uncheckedCountAtom,
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
  test("registers the given ids in their order", () => {
    const [a, b, c] = [createId(), createId(), createId()];
    setAll(store, [entry(a, { title: "Dom Casmurro" }), entry(b), entry(c)]);

    expect(store.get(publicationIdsAtom)).toEqual([a, b, c]);
    expect(store.get(publicationCountAtom)).toBe(3);
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
      // A saved row, an unsaved row and the draft row.
      entry(7, { title: "Dom Casmurro" }),
      entry(minted, { title: "Iracema" }),
      entry(DRAFT_ID, { title: "Barren Lives" }),
    ]);

    // A cell is cached under an `<id>:<key>` string, so each kind of id must
    // read back from that string as the same value.
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

    // A cell key is text. `forget` drops a cell only when its key reads back as
    // the id of a forgotten row.
    expect(knownIds().has(7)).toBe(false);
    expect(knownIds().has(minted)).toBe(false);
  });
});

describe("checked rows", () => {
  test("rows loaded with their validation results are checked", () => {
    setAll(store, [entry(createId()), entry(createId())]);

    expect(store.get(uncheckedCountAtom)).toBe(0);
  });

  test("an edit leaves the row unchecked until a result for its new content arrives", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" }), entry(createId())]);

    setField(store, a, "title", "Dom Casmurro, revised");
    expect(store.get(uncheckedCountAtom)).toBe(1);

    setErrors(store, [
      { id: a, publication: store.get(publicationFamily(a)), errors: null },
    ]);
    expect(store.get(uncheckedCountAtom)).toBe(0);
  });

  // A result computed for content the row no longer has does not check it, so a
  // slow response for an older version cannot enable the submit button.
  test("a result for older content leaves the row unchecked", () => {
    const a = createId();
    setAll(store, [entry(a, { title: "Dom Casmurro" })]);
    const before = store.get(publicationFamily(a));

    setField(store, a, "title", "Dom Casmurro, revised");
    setErrors(store, [{ id: a, publication: before, errors: null }]);

    expect(store.get(uncheckedCountAtom)).toBe(1);
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

describe("moving rows out", () => {
  test("moveOut takes rows out of the list and out of the counts", () => {
    const [a, b, c] = [createId(), createId(), createId()];
    setAll(store, [entry(a), entry(b), entry(c)]);

    moveOut(store, [a, c]);

    expect(store.get(publicationIdsAtom)).toEqual([b]);
    expect(store.get(publicationCountAtom)).toBe(1);
    expect(store.get(validCountAtom)).toBe(1);
  });

  test("an undo does not bring a moved row back", () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [entry(a), entry(b)]);
    setField(store, b, "title", "Dom Casmurro");

    moveOut(store, [a]);
    documentOf(store).undo.undo();

    // The undo reverts the edit to the row that stayed, not the move.
    expect(store.get(publicationIdsAtom)).toEqual([b]);
    expect(store.get(fieldValueFamily({ id: b, key: "title" }))).toBe("");
  });

  test("what was checked about a moved row is dropped", () => {
    const a = createId();
    setAll(store, [entry(a, {}, "conflict")]);

    moveOut(store, [a]);

    expect(store.get(errorFamily(a))).toBeNull();
  });
});

describe("edits", () => {
  test("an edit changes the row and leaves its saved copy as it was", () => {
    hydrate(store, [saved(1, "Dom Casmurro")]);

    setField(store, 1, "title", "Dom Casmurro (rev.)");

    // `fieldValueFamily` reads the edit...
    expect(store.get(fieldValueFamily({ id: 1, key: "title" }))).toBe(
      "Dom Casmurro (rev.)",
    );
    // ...and `storedFieldValueFamily` still reads the saved value.
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

    // There is no saved copy, so the row keeps its edit.
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

    // The key is a UUID. A counter would start at the same value in every
    // browser and give two people's new rows the same key.
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // The key is a string, so it cannot be mistaken for a server id.
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

    // Dropping the row would discard what the admin is typing, so a load that
    // runs while an editor is open keeps it. The row is no longer listed,
    // since the load did not return it.
    expect(store.get(publicationFamily(1)).title).toBe("Being typed");
    expect(store.get(publicationIdsAtom)).toEqual([2]);
  });

  test("a row with unsaved edits keeps them when a load returns it again", () => {
    hydrate(store, [saved(1, "Dom Casmurro")]);
    setField(store, 1, "title", "Being typed");

    hydrate(store, [saved(1, "Dom Casmurro, as someone else saved it")]);

    // The row keeps the edit, and only the saved copy is updated.
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

describe("receiveIndex", () => {
  /** An index page, as the backend answers a query. */
  const page = (entries: ReturnType<typeof saved>[]) => ({
    entries,
    matched: [],
    total: entries.length,
    order: entries.map(({ id }) => id),
    perPage: 50,
  });

  // A first load into a new store writes an empty order to an empty document,
  // which changes nothing, so the document's observer never sets the ids.
  test("an empty first page leaves a loaded working set with no rows", () => {
    expect(store.get(publicationIdsAtom)).toBeUndefined();

    receiveIndex(store, page([]));

    expect(store.get(publicationIdsAtom)).toEqual([]);
  });

  test("an empty page after a full one leaves no rows", () => {
    receiveIndex(store, page([saved(1), saved(2)]));
    expect(store.get(publicationIdsAtom)).toEqual([1, 2]);

    receiveIndex(store, page([]));

    expect(store.get(publicationIdsAtom)).toEqual([]);
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

describe("look-alikes", () => {
  const RESEMBLES = {
    stored: [{ ...empty(), id: 7, title: "Dom Casmurro" }],
    others: [],
    repeats: null,
  };

  function measured() {
    setAll(store, [
      entry(1, { title: "Dom Casmurro", authors: ["Helen Caldwell"] }),
    ]);
    setResemblances(store, [1], new Map([[1, RESEMBLES]]));
  }

  test("stands while the row is the one it was measured on", () => {
    measured();

    expect(store.get(resemblanceFamily(1))).toEqual(RESEMBLES);
  });

  test("goes when a field the check reads is edited", () => {
    measured();
    setField(store, 1, "title", "Dom Casmuro");

    expect(store.get(resemblanceFamily(1))).toBeNull();
  });

  test("stands when a field the check does not read is edited", () => {
    measured();
    setSources(store, 1, ["A source"]);

    expect(store.get(resemblanceFamily(1))).toEqual(RESEMBLES);
  });

  // An edit from another person replaces the row in `publicationFamily` without
  // calling `setField`. The result must still be dropped in that case.
  test("goes when the row is replaced outright, as an edit from elsewhere arrives", () => {
    measured();
    store.set(publicationFamily(1), {
      ...store.get(publicationFamily(1)),
      title: "Dom Casmuro",
    });

    expect(store.get(resemblanceFamily(1))).toBeNull();
  });
});

describe("a row that repeats an earlier row", () => {
  const ROW = { title: "Dom Casmurro", authors: ["Helen Caldwell"] };

  // Rows 1 and 2 have the same key, so the look-alike check reports row 2 as a
  // repeat of row 1.
  function repeated() {
    setAll(store, [entry(1, ROW), entry(2, ROW)]);
    setResemblances(
      store,
      [1, 2],
      new Map([
        [1, { stored: [], others: [2], repeats: null }],
        [2, { stored: [], others: [1], repeats: 1 }],
      ]),
    );
  }

  test("is invalid, with the error repeated, while the earlier row stays valid", () => {
    repeated();

    expect(store.get(rowErrorFamily(2))).toBe("repeated");
    expect(store.get(isValidFamily(2))).toBe(false);
    expect(store.get(isValidFamily(1))).toBe(true);
    expect(store.get(validCountAtom)).toBe(1);
    expect(store.get(invalidIdsAtom)).toEqual([2]);
  });

  test("shows its validation error rather than the repeat when it has one", () => {
    repeated();
    setErrors(store, [entry(2, ROW, "conflict")]);

    expect(store.get(rowErrorFamily(2))).toBe("conflict");
  });

  test("is valid again once a field the check reads is edited", () => {
    repeated();
    setField(store, 2, "year", "1960");

    expect(store.get(rowErrorFamily(2))).toBeNull();
    expect(store.get(validCountAtom)).toBe(2);
  });

  test("is where focusing the next invalid row goes", () => {
    repeated();
    focusNextInvalid(store);

    expect(store.get(focusedRowIdAtom)).toBe(2);
  });
});

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
  createId,
  deletedCountAtom,
  duplicate,
  fieldValueFamily,
  focusNextInvalid,
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
  resetDeleted,
  resetOverridden,
  setAll,
  setAttributesVisible,
  setDeleted,
  setErrors,
  store,
  totalCountAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
  visiblePublicationFamily,
} from "./store";

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
  // The store is a module singleton; give every test a clean slate. `resetAll`
  // only touches rows currently in the id list, so reset the draft (never
  // listed) and the attribute toggles explicitly.
  resetAll();
  store.set(overrideFamily(DRAFT_ID), RESET);
  resetAttributes();
});

describe("setAll", () => {
  test("registers the given ids and exposes them as visible", () => {
    const [a, b, c] = [createId(), createId(), createId()];
    setAll([entry(a, { title: "Dom Casmurro" }), entry(b), entry(c)]);

    expect(store.get(publicationIdsAtom)).toEqual([a, b, c]);
    expect(store.get(visibleIdsAtom)).toEqual([a, b, c]);
    expect(store.get(totalCountAtom)).toBe(3);
    expect(store.get(visibleCountAtom)).toBe(3);
  });

  test("a cell reads its publication's field", () => {
    const a = createId();
    setAll([entry(a, { title: "Dom Casmurro" })]);

    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro",
    );
  });
});

describe("validity", () => {
  test("only error-free rows count as valid", () => {
    const [a, b] = [createId(), createId()];
    setAll([entry(a), entry(b, {}, "conflict")]);

    expect(store.get(validCountAtom)).toBe(1);
    expect(store.get(isValidFamily(a))).toBe(true);
    expect(store.get(isValidFamily(b))).toBe(false);
  });

  test("setErrors flips a loaded row to invalid", () => {
    const a = createId();
    setAll([entry(a)]);
    expect(store.get(validCountAtom)).toBe(1);

    setErrors([entry(a, {}, fieldErrors({ title: "required" }))]);

    expect(store.get(isValidFamily(a))).toBe(false);
    expect(store.get(validCountAtom)).toBe(0);
  });
});

describe("deletion", () => {
  test("setDeleted hides a row without dropping it from the list", () => {
    const [a, b] = [createId(), createId()];
    setAll([entry(a), entry(b)]);

    setDeleted([a]);

    expect(store.get(visibleIdsAtom)).toEqual([b]);
    expect(store.get(visibleCountAtom)).toBe(1);
    expect(store.get(deletedCountAtom)).toBe(1);
    expect(store.get(totalCountAtom)).toBe(2);
  });

  test("a deleted row no longer counts as valid", () => {
    const [a, b] = [createId(), createId()];
    setAll([entry(a), entry(b)]);
    expect(store.get(validCountAtom)).toBe(2);

    setDeleted([a]);

    expect(store.get(validCountAtom)).toBe(1);
  });

  test("resetDeleted brings hidden rows back", () => {
    const [a, b] = [createId(), createId()];
    setAll([entry(a), entry(b)]);
    setDeleted([a]);
    expect(store.get(visibleCountAtom)).toBe(1);

    resetDeleted();

    expect(store.get(visibleIdsAtom)).toEqual([a, b]);
  });
});

describe("overrides", () => {
  test("overrideField layers an edit over the stored publication", () => {
    const a = createId();
    setAll([entry(a, { title: "Dom Casmurro" })]);

    overrideField(a, "title", "Dom Casmurro (rev.)");

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
    setAll([entry(a, { title: "Dom Casmurro" })]);
    overrideField(a, "title", "changed");
    expect(store.get(overriddenCountAtom)).toBe(1);

    resetOverridden();

    expect(store.get(overriddenCountAtom)).toBe(0);
    expect(store.get(fieldValueFamily({ id: a, key: "title" }))).toBe(
      "Dom Casmurro",
    );
  });
});

describe("addNew", () => {
  test("commits the typed draft as a real row and clears the draft", () => {
    const a = createId();
    setAll([entry(a)]);

    // Type into the always-present draft row, then commit it.
    overrideField(DRAFT_ID, "title", "A Hora da Estrela");
    const newId = addNew();

    expect(store.get(publicationIdsAtom)).toEqual([a, newId]);
    expect(store.get(publicationFamily(newId)).title).toBe("A Hora da Estrela");
    // The draft resets to empty, ready for the next entry.
    expect(store.get(visiblePublicationFamily(DRAFT_ID)).title).toBe("");
  });

  test("refuses to run before entries are loaded", () => {
    // beforeEach left the id list unset (RESET → undefined).
    expect(() => addNew()).toThrow();
  });
});

describe("duplicate", () => {
  test("inserts a copy immediately after each selected row", () => {
    const [a, b] = [createId(), createId()];
    setAll([
      entry(a, { title: "Dom Casmurro" }),
      entry(b, { title: "Grande Sertão" }),
    ]);

    const [copyId] = duplicate(new Set([a]));

    expect(store.get(publicationIdsAtom)).toEqual([a, copyId, b]);
    expect(store.get(publicationFamily(copyId)).title).toBe("Dom Casmurro");
  });
});

describe("attribute visibility", () => {
  test("hiding an attribute moves it from visible to hidden", () => {
    expect(store.get(visibleAttributesAtom)).toContain("year");

    setAttributesVisible(["year"], false);

    expect(store.get(visibleAttributesAtom)).not.toContain("year");
    expect(store.get(hiddenAttributesAtom)).toContain("year");
  });

  test("resetAttributes restores default visibility", () => {
    setAttributesVisible(["year"], false);

    resetAttributes();

    expect(store.get(visibleAttributesAtom)).toContain("year");
  });
});

describe("focusNextInvalid", () => {
  test("steps through invalid rows and wraps back to the first", () => {
    const [a, b, c, d] = [createId(), createId(), createId(), createId()];
    setAll([
      entry(a),
      entry(b, {}, "conflict"),
      entry(c),
      entry(d, {}, "conflict"),
    ]);

    // Nothing focused yet → first invalid (b).
    focusNextInvalid();
    expect(store.get(focusedRowIdAtom)).toBe(b);

    // → next invalid after b (d).
    focusNextInvalid();
    expect(store.get(focusedRowIdAtom)).toBe(d);

    // → nothing invalid after d, so wrap around to b.
    focusNextInvalid();
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

import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import * as Y from "yjs";

import type { Store } from "modules/store";
import { empty, type Publication, type PublicationId } from "./model";
import {
  addNew,
  duplicate,
  forget,
  knownIds,
  openWorkspace,
  overrideField,
  overrideSources,
  publicationIdsAtom,
  removePublication,
  setAll,
  visiblePublicationFamily,
  visibleIdsAtom,
} from "./store";

/**
 * A workspace as a person has it: a store to read, a document to write, and the
 * observer between them.
 */
function workspace() {
  const store = createStore();
  const doc = new Y.Doc();
  const close = openWorkspace(store, doc);

  return { store, doc, close };
}

function entry(id: PublicationId, fields: Partial<Publication> = {}) {
  return { id, publication: { ...empty(), ...fields }, errors: null };
}

const titleOf = (store: Store, id: PublicationId) =>
  store.get(visiblePublicationFamily(id)).title;

let open: (() => void)[] = [];

beforeEach(() => {
  forget(knownIds());
});

afterEach(() => {
  open.forEach((close) => close());
  open = [];
});

/** Track a workspace so its observer is taken down with the test. */
function opened() {
  const made = workspace();
  open.push(made.close);

  return made;
}

describe("a store working in a document", () => {
  test("an upload lands in the document and reads back through the atoms", () => {
    const { store, doc } = opened();

    setAll(store, [
      entry("a", { title: "Dom Casmurro" }),
      entry("b", { title: "Iracema" }),
    ]);

    // The document is what holds it...
    expect(doc.getArray("order").toArray()).toEqual(["a", "b"]);

    // ...and the atoms the whole application reads are fed from it.
    expect(store.get(publicationIdsAtom)).toEqual(["a", "b"]);
    expect(titleOf(store, "a")).toBe("Dom Casmurro");
  });

  test("editing a cell writes the document, not an overlay", () => {
    const { store, doc } = opened();

    setAll(store, [entry("a", { title: "Dom Casmuro" })]);
    overrideField(store, "a", "title", "Dom Casmurro");

    // Nothing is uncommitted: the edit is the value, and it is in the document
    // the moment it is typed.
    expect(doc.getMap<Y.Map<unknown>>("rows").get("a")?.get("title")).toBe(
      "Dom Casmurro",
    );
    expect(titleOf(store, "a")).toBe("Dom Casmurro");
  });

  test("a new row is added to the document", () => {
    const { store, doc } = opened();

    setAll(store, [entry("a", { title: "Dom Casmurro" })]);
    const id = addNew(store);

    expect(doc.getArray("order").toArray()).toEqual(["a", String(id)]);
    expect(store.get(visibleIdsAtom)).toEqual(["a", id]);
  });

  test("a duplicate is placed right after the row it came from", () => {
    const { store, doc } = opened();

    setAll(store, [
      entry("a", { title: "Dom Casmurro" }),
      entry("b", { title: "Iracema" }),
    ]);

    const [copy] = duplicate(store, new Set(["a"]));

    expect(doc.getArray("order").toArray()).toEqual(["a", String(copy), "b"]);
    expect(titleOf(store, copy)).toBe("Dom Casmurro");
  });

  test("removing a row takes it out of the document", () => {
    const { store, doc } = opened();

    setAll(store, [
      entry("a", { title: "Dom Casmurro" }),
      entry("b", { title: "Iracema" }),
    ]);
    removePublication(store, "a");

    expect(doc.getArray("order").toArray()).toEqual(["b"]);
    expect(store.get(publicationIdsAtom)).toEqual(["b"]);
  });

  test("sources are written as a list that merges", () => {
    const { store, doc } = opened();

    setAll(store, [entry("a", { title: "Dom Casmurro", sources: [] })]);
    overrideSources(store, "a", ["Caldwell, Helen. Introduction, 1953."]);

    expect(
      doc.getMap<Y.Map<unknown>>("rows").get("a")?.get("sources"),
    ).toBeInstanceOf(Y.Array);
    expect(store.get(visiblePublicationFamily("a")).sources).toEqual([
      "Caldwell, Helen. Introduction, 1953.",
    ]);
  });

  test("closing it stops the atoms following the document", () => {
    const { store, doc, close } = workspace();

    setAll(store, [entry("a", { title: "Dom Casmurro" })]);
    close();

    // A change nobody is listening for any more.
    doc.getMap<Y.Map<unknown>>("rows").get("a")?.set("title", "Iracema");

    expect(titleOf(store, "a")).toBe("Dom Casmurro");
  });
});

describe("two people in one workspace", () => {
  /** Hand each document what the other knows, as a relay between them would. */
  const sync = (here: Y.Doc, there: Y.Doc) => {
    Y.applyUpdate(
      there,
      Y.encodeStateAsUpdate(here, Y.encodeStateVector(there)),
    );
    Y.applyUpdate(
      here,
      Y.encodeStateAsUpdate(there, Y.encodeStateVector(here)),
    );
  };

  test("an edit made in one workspace is read in the other", () => {
    const mine = opened();
    const yours = opened();

    setAll(mine.store, [entry("a", { title: "Dom Casmuro" })]);
    sync(mine.doc, yours.doc);

    expect(titleOf(yours.store, "a")).toBe("Dom Casmuro");

    overrideField(mine.store, "a", "title", "Dom Casmurro");
    sync(mine.doc, yours.doc);

    // The atoms on the other side are fed by the observer, so the cell reading
    // that field re-renders without anything asking it to.
    expect(titleOf(yours.store, "a")).toBe("Dom Casmurro");
  });

  test("each editing a different cell of one row clobbers neither", () => {
    const mine = opened();
    const yours = opened();

    setAll(mine.store, [entry("a", { title: "Dom Casmuro", year: "1952" })]);
    sync(mine.doc, yours.doc);

    // Neither has seen the other's change when they make their own.
    overrideField(mine.store, "a", "title", "Dom Casmurro");
    overrideField(yours.store, "a", "year", "1953");
    sync(mine.doc, yours.doc);

    [mine, yours].forEach(({ store }) =>
      expect(store.get(visiblePublicationFamily("a"))).toMatchObject({
        title: "Dom Casmurro",
        year: "1953",
      }),
    );
  });

  test("each adding a source to one row keeps both", () => {
    const mine = opened();
    const yours = opened();

    setAll(mine.store, [entry("a", { title: "Dom Casmurro", sources: [] })]);
    sync(mine.doc, yours.doc);

    overrideSources(mine.store, "a", ["Caldwell, Helen. Introduction, 1953."]);
    overrideSources(yours.store, "a", [
      "Gledson, John. Deceptive Realism, 1984.",
    ]);
    sync(mine.doc, yours.doc);

    const kept = mine.store.get(visiblePublicationFamily("a")).sources;

    expect(kept).toHaveLength(2);
    expect(yours.store.get(visiblePublicationFamily("a")).sources).toEqual(
      kept,
    );
  });
});

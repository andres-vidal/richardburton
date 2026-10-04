import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import * as Y from "yjs";

import type { Store } from "modules/store";
import { empty, type Publication, type PublicationId } from "./model";
import {
  DRAFT_ID,
  addNew,
  documentOf,
  duplicate,
  forget,
  knownIds,
  openWorkspace,
  publicationFamily,
  publicationIdsAtom,
  removePublication,
  replaceName,
  setAll,
  setField,
  setSources,
} from "./store";

/**
 * One person's workspace: a store bound with `openWorkspace` to a Yjs document,
 * which its observer copies into the store's atoms.
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
  store.get(publicationFamily(id)).title;

let open: (() => void)[] = [];

beforeEach(() => {
  forget(knownIds());
});

afterEach(() => {
  open.forEach((close) => close());
  open = [];
});

/** Opens a workspace that is closed after the test. */
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

    // The document holds the rows...
    expect(doc.getArray("order").toArray()).toEqual(["a", "b"]);

    // ...and the observer copies them into the atoms.
    expect(store.get(publicationIdsAtom)).toEqual(["a", "b"]);
    expect(titleOf(store, "a")).toBe("Dom Casmurro");
  });

  test("editing a cell writes the document", () => {
    const { store, doc } = opened();

    setAll(store, [entry("a", { title: "Dom Casmuro" })]);
    setField(store, "a", "title", "Dom Casmurro");

    // The edit is written to the document at once. There is no separate layer
    // of unsaved edits.
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
    expect(store.get(publicationIdsAtom)).toEqual(["a", id]);
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
    setSources(store, "a", ["Caldwell, Helen. Introduction, 1953."]);

    expect(
      doc.getMap<Y.Map<unknown>>("rows").get("a")?.get("sources"),
    ).toBeInstanceOf(Y.Array);
    expect(store.get(publicationFamily("a")).sources).toEqual([
      "Caldwell, Helen. Introduction, 1953.",
    ]);
  });

  test("closing it stops the atoms following the document", () => {
    const { store, doc, close } = workspace();

    setAll(store, [entry("a", { title: "Dom Casmurro" })]);
    close();

    // This change is made after the observer has stopped.
    doc.getMap<Y.Map<unknown>>("rows").get("a")?.set("title", "Iracema");

    expect(titleOf(store, "a")).toBe("Dom Casmurro");
  });
});

describe("two people in one workspace", () => {
  /** Gives each document the changes the other has, as the channel does. */
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

    setField(mine.store, "a", "title", "Dom Casmurro");
    sync(mine.doc, yours.doc);

    // The other store's observer copies the change into its atoms, so a cell
    // reading that field re-renders with no other call.
    expect(titleOf(yours.store, "a")).toBe("Dom Casmurro");
  });

  test("each editing a different cell of one row clobbers neither", () => {
    const mine = opened();
    const yours = opened();

    setAll(mine.store, [entry("a", { title: "Dom Casmuro", year: "1952" })]);
    sync(mine.doc, yours.doc);

    // Both edits are made before either document has the other's.
    setField(mine.store, "a", "title", "Dom Casmurro");
    setField(yours.store, "a", "year", "1953");
    sync(mine.doc, yours.doc);

    [mine, yours].forEach(({ store }) =>
      expect(store.get(publicationFamily("a"))).toMatchObject({
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

    setSources(mine.store, "a", ["Caldwell, Helen. Introduction, 1953."]);
    setSources(yours.store, "a", ["Gledson, John. Deceptive Realism, 1984."]);
    sync(mine.doc, yours.doc);

    const kept = mine.store.get(publicationFamily("a")).sources;

    expect(kept).toHaveLength(2);
    expect(yours.store.get(publicationFamily("a")).sources).toEqual(kept);
  });
});

describe("the draft row", () => {
  test("is typed into without reaching the document", () => {
    const { store, doc } = opened();

    setField(store, DRAFT_ID, "title", "Dom Casmurro");

    // The draft row is not written to the document, so other people do not
    // receive it.
    expect(doc.getArray("order").toArray()).toEqual([]);
    expect(titleOf(store, DRAFT_ID)).toBe("Dom Casmurro");
  });

  test("is handed to the document whole when it is added", () => {
    const { store, doc } = opened();

    setField(store, DRAFT_ID, "title", "Dom Casmurro");
    setField(store, DRAFT_ID, "year", "1953");
    const id = addNew(store);

    expect(doc.getArray("order").toArray()).toEqual([String(id)]);
    expect(store.get(publicationFamily(id))).toMatchObject({
      title: "Dom Casmurro",
      year: "1953",
    });

    // The draft row is empty again, ready for the next row.
    expect(titleOf(store, DRAFT_ID)).toBe("");
  });
});

describe("replacing a name", () => {
  test("rewrites it in every row that carries it, and leaves the rest alone", () => {
    const { store } = opened();

    setAll(store, [
      entry("a", { authors: ["Isabel Burton", "Richard Burton"] }),
      entry("b", { authors: ["Isabel Burton"] }),
      entry("c", { authors: ["Helen Caldwell"] }),
    ]);

    replaceName(
      store,
      "authors",
      ["a", "b", "c"],
      "Isabel Burton",
      "Isabel Arundell",
    );

    expect(store.get(publicationFamily("a")).authors).toEqual([
      "Isabel Arundell",
      "Richard Burton",
    ]);
    expect(store.get(publicationFamily("b")).authors).toEqual([
      "Isabel Arundell",
    ]);
    expect(store.get(publicationFamily("c")).authors).toEqual([
      "Helen Caldwell",
    ]);
  });

  test("keeps a name once in a row that would carry it twice", () => {
    const { store } = opened();

    setAll(store, [entry("a", { authors: ["I. Burton", "Isabel Burton"] })]);

    replaceName(store, "authors", ["a"], "I. Burton", "Isabel Burton");

    expect(store.get(publicationFamily("a")).authors).toEqual([
      "Isabel Burton",
    ]);
  });

  // A replacement emits one document update, however many rows it changes.
  test("changes every row it touches in one update", () => {
    const { store, doc } = opened();

    setAll(store, [
      entry("a", { authors: ["Isabel Burton"] }),
      entry("b", { authors: ["Isabel Burton"] }),
    ]);

    let updates = 0;
    doc.on("update", () => (updates += 1));

    replaceName(
      store,
      "authors",
      ["a", "b"],
      "Isabel Burton",
      "Isabel Arundell",
    );

    expect(updates).toBe(1);
  });

  test("is its own step to undo, even straight after another edit", () => {
    const { store } = opened();

    setAll(store, [
      entry("a", { title: "Iracema", authors: ["Isabel Burton"] }),
      entry("b", { authors: ["Isabel Burton"] }),
    ]);

    setField(store, "a", "title", "Iracema, the Honey-Lips");
    replaceName(
      store,
      "authors",
      ["a", "b"],
      "Isabel Burton",
      "Isabel Arundell",
    );
    documentOf(store).undo.undo();

    // Undo restores every row the replacement changed...
    expect(store.get(publicationFamily("a")).authors).toEqual([
      "Isabel Burton",
    ]);
    expect(store.get(publicationFamily("b")).authors).toEqual([
      "Isabel Burton",
    ]);
    // ...but not the title edit made just before it.
    expect(store.get(publicationFamily("a")).title).toBe(
      "Iracema, the Honey-Lips",
    );
  });
});

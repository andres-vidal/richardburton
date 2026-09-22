import { createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import * as Y from "yjs";

import { keepDraft } from "./draft";
import {
  DRAFT_ID,
  addNew,
  forget,
  knownIds,
  openWorkspace,
  overrideField,
  publicationFamily,
  setAll,
} from "./store";

let stop: (() => void) | undefined;

beforeEach(() => {
  forget(knownIds());
  localStorage.clear();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
});

describe("the draft row across reloads", () => {
  test("what was typed into it is there the next time", () => {
    const first = createStore();
    stop = keepDraft(first, "a-workspace");

    overrideField(first, DRAFT_ID, "title", "Iracema");
    overrideField(first, DRAFT_ID, "authors", ["Isabel Burton"]);

    stop();

    // A second visit: a new store, nothing carried over in memory.
    const second = createStore();
    stop = keepDraft(second, "a-workspace");

    expect(second.get(publicationFamily(DRAFT_ID))).toMatchObject({
      title: "Iracema",
      authors: ["Isabel Burton"],
    });
  });

  test("each workspace has its own", () => {
    const store = createStore();

    stop = keepDraft(store, "one");
    overrideField(store, DRAFT_ID, "title", "Iracema");
    stop();

    const elsewhere = createStore();
    stop = keepDraft(elsewhere, "another");

    expect(elsewhere.get(publicationFamily(DRAFT_ID)).title).toBe("");
  });

  test("adding the row leaves nothing to come back to", () => {
    // A real workspace, since adding a row is what empties the draft.
    const store = createStore();
    const close = openWorkspace(store, new Y.Doc());
    setAll(store, []);

    stop = keepDraft(store, "a-workspace");

    overrideField(store, DRAFT_ID, "title", "Iracema");
    addNew(store);

    stop();
    close();

    const second = createStore();
    stop = keepDraft(second, "a-workspace");

    // The row is in the workspace now; the draft is not still holding a copy.
    expect(second.get(publicationFamily(DRAFT_ID)).title).toBe("");
  });

  test("a workspace keeps the draft it was typed into", () => {
    const store = createStore();
    const close = openWorkspace(store, new Y.Doc());
    setAll(store, []);

    stop = keepDraft(store, "a-workspace");
    overrideField(store, DRAFT_ID, "title", "Iracema");

    stop();
    close();

    const second = createStore();
    const reopened = openWorkspace(second, new Y.Doc());
    stop = keepDraft(second, "a-workspace");

    expect(second.get(publicationFamily(DRAFT_ID)).title).toBe("Iracema");

    reopened();
  });

  test("storage that refuses to be written to is not an error", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    const store = createStore();
    stop = keepDraft(store, "a-workspace");

    // A draft row is not worth failing the page over.
    expect(() =>
      overrideField(store, DRAFT_ID, "title", "Iracema"),
    ).not.toThrow();
  });

  test("something unreadable in storage leaves the draft empty", () => {
    localStorage.setItem("rb:draft:a-workspace", "not json");

    const store = createStore();
    stop = keepDraft(store, "a-workspace");

    expect(store.get(publicationFamily(DRAFT_ID)).title).toBe("");
  });
});

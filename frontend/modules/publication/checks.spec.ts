import { request } from "app";
import type { AxiosInstance } from "axios";
import { createStore } from "jotai";
import * as Y from "yjs";

import type { Store } from "modules/store";
import { FALLBACK, SETTLE, watchChecks } from "./checks";
import { empty, type Publication, type PublicationId } from "./model";
import {
  errorFamily,
  forget,
  knownIds,
  openWorkspace,
  resemblanceFamily,
  setAll,
  setDiscarded,
  setErrors,
  setField,
  setSources,
} from "./store";

vi.mock("app", () => ({ request: vi.fn() }));
vi.mock("components/Notifications", () => ({ notify: vi.fn() }));

const mockRequest = vi.mocked(request);

/**
 * A fake server. Validation finds the error "required" in a row with no title,
 * and the look-alike check finds that every row resembles the stored record
 * `STORED`.
 */
const post = vi.fn(async (url: string, body: Publication[]) =>
  url === "publications/validate"
    ? {
        data: body.map((publication) => ({
          publication,
          errors: publication.title ? null : "required",
        })),
      }
    : {
        data: {
          entries: body.map((_row, position) => ({
            position,
            stored: [STORED],
            others: [],
          })),
        },
      },
);

const STORED: Publication = { ...empty(), id: 7, title: "Dom Casmurro" };

/** The bodies sent to `url`, one per request. */
const sentTo = (url: string) =>
  post.mock.calls.filter(([to]) => to === url).map(([, body]) => body);

const validated = () => sentTo("publications/validate");
const measured = () => sentTo("publications/duplicates/resemblances");

function entry(id: PublicationId, fields: Partial<Publication> = {}) {
  return { id, publication: { ...empty(), ...fields }, errors: null };
}

/** One person's workspace, with or without the checks running. */
function workspace(checked: boolean) {
  const store: Store = createStore();
  const doc = new Y.Doc();
  const close = openWorkspace(store, doc);
  const checks = checked ? watchChecks(store, doc) : undefined;

  open.push(() => {
    checks?.stop();
    close();
  });

  return { store, doc, checks };
}

/** Gives each document the changes the other has, as the channel does. */
const sync = (here: Y.Doc, there: Y.Doc) => {
  Y.applyUpdate(there, Y.encodeStateAsUpdate(here, Y.encodeStateVector(there)));
  Y.applyUpdate(here, Y.encodeStateAsUpdate(there, Y.encodeStateVector(here)));
};

let open: (() => void)[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  forget(knownIds());
  post.mockClear();
  mockRequest.mockImplementation(((op: (client: AxiosInstance) => unknown) =>
    op({ post } as unknown as AxiosInstance)) as typeof request);
});

afterEach(() => {
  open.forEach((close) => close());
  open = [];
  vi.useRealTimers();
});

/** Lets every pending check run, and clears the record of requests. */
async function settled() {
  await vi.advanceTimersByTimeAsync(FALLBACK);
  post.mockClear();
}

describe("this client's edits", () => {
  test("are checked once they settle, and only the rows edited are validated", async () => {
    const { store } = workspace(true);

    setAll(store, [
      entry("a", { title: "Dom Casmurro" }),
      entry("b", { title: "Iracema" }),
    ]);
    await settled();

    setField(store, "a", "title", "");
    await vi.advanceTimersByTimeAsync(SETTLE - 1);

    expect(post).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(validated()).toHaveLength(1);
    expect(validated()[0]).toEqual([expect.objectContaining({ title: "" })]);
    expect(store.get(errorFamily("a"))).toBe("required");
    expect(measured()).toHaveLength(1);
  });

  test("an upload is not validated again, since it was validated as it was read", async () => {
    const { store } = workspace(true);

    setAll(store, [entry("a", { title: "Dom Casmurro" })]);
    await vi.advanceTimersByTimeAsync(SETTLE);

    expect(validated()).toHaveLength(0);
    expect(measured()).toHaveLength(1);
  });

  test("an edit outside the look-alike rule's fields does not run the look-alike check", async () => {
    const { store } = workspace(true);

    setAll(store, [entry("a", { title: "Dom Casmurro" })]);
    await settled();

    setSources(store, "a", ["Caldwell, Helen. Introduction."]);
    await vi.advanceTimersByTimeAsync(SETTLE);

    expect(validated()).toHaveLength(1);
    expect(measured()).toHaveLength(0);
  });

  test("discarding a row runs the look-alike check again, without validating", async () => {
    const { store } = workspace(true);

    setAll(store, [
      entry("a", { title: "Dom Casmurro" }),
      entry("b", { title: "Iracema" }),
    ]);
    await settled();

    setDiscarded(store, ["b"]);
    await vi.advanceTimersByTimeAsync(SETTLE);

    expect(validated()).toHaveLength(0);
    expect(measured()).toEqual([
      [expect.objectContaining({ title: "Dom Casmurro" })],
    ]);
  });

  test("are not checked after the checks stop", async () => {
    const { store, checks } = workspace(true);

    setAll(store, [entry("a", { title: "Dom Casmurro" })]);
    await settled();

    setField(store, "a", "title", "");
    checks?.stop();
    await vi.advanceTimersByTimeAsync(FALLBACK);

    expect(post).not.toHaveBeenCalled();
  });
});

describe("another client's edits", () => {
  test("are left to that client, whose results this client reads", async () => {
    const mine = workspace(true);
    const yours = workspace(true);

    setAll(yours.store, [entry("a", { title: "Dom Casmurro" })]);
    sync(mine.doc, yours.doc);
    mine.checks?.refresh();
    await settled();

    setField(yours.store, "a", "title", "");
    sync(mine.doc, yours.doc);

    // Your checks validate your edit and store the result, which reaches my
    // document.
    await vi.advanceTimersByTimeAsync(SETTLE);
    sync(mine.doc, yours.doc);

    expect(validated()).toHaveLength(1);
    expect(mine.store.get(errorFamily("a"))).toBe("required");
    expect(mine.store.get(resemblanceFamily("a"))).toEqual({
      stored: [STORED],
      others: [],
    });

    // When my fallback runs, there is nothing left to check.
    await vi.advanceTimersByTimeAsync(FALLBACK);

    expect(validated()).toHaveLength(1);
    expect(measured()).toHaveLength(1);
  });

  test("are checked here when no result arrives", async () => {
    const mine = workspace(true);
    const yours = workspace(false);

    setAll(yours.store, [entry("a", { title: "Dom Casmurro" })]);
    sync(mine.doc, yours.doc);
    mine.checks?.refresh();
    await settled();

    // You have no checks running, so your edit arrives with no result.
    setField(yours.store, "a", "title", "");
    sync(mine.doc, yours.doc);

    await vi.advanceTimersByTimeAsync(FALLBACK - 1);
    expect(post).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(validated()).toHaveLength(1);
    expect(measured()).toHaveLength(1);
    expect(mine.store.get(errorFamily("a"))).toBe("required");
  });

  test("are not checked here before the first refresh", async () => {
    const mine = workspace(true);
    const yours = workspace(false);

    setAll(yours.store, [entry("a", { title: "" })]);
    sync(mine.doc, yours.doc);
    await vi.advanceTimersByTimeAsync(FALLBACK);

    expect(post).not.toHaveBeenCalled();
  });
});

describe("refresh", () => {
  test("validates every visible row and runs the look-alike check, whatever is stored", async () => {
    const { store, checks } = workspace(true);

    setAll(store, [
      entry("a", { title: "Dom Casmurro" }),
      entry("b", { title: "Iracema" }),
      entry("c", { title: "Barren Lives" }),
    ]);
    setDiscarded(store, ["c"]);
    await settled();

    // The stored result for "a" says it is valid. A refresh asks again.
    setErrors(store, [entry("a", { title: "Dom Casmurro" })]);
    checks?.refresh();
    await vi.advanceTimersByTimeAsync(0);

    expect(validated()).toEqual([
      [
        expect.objectContaining({ title: "Dom Casmurro" }),
        expect.objectContaining({ title: "Iracema" }),
      ],
    ]);
    expect(measured()).toHaveLength(1);
  });
});

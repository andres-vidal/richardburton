import { request } from "app";
import { createStore } from "jotai";
import type { AxiosInstance } from "axios";
import { notify } from "components/Notifications";

import type { Store } from "modules/store";

import type { Publication, PublicationId } from "./model";
import { empty } from "./model";
import {
  bulk,
  deletePublication,
  merge,
  resemblances,
  restore,
  search,
  undo,
  update,
  upload,
  validate,
  validateUpdate,
} from "./remote";
import * as Doc from "./doc";
import {
  contentKey,
  createId,
  documentOf,
  errorFamily,
  hydrate,
  isCheckedFamily,
  lastValidatedFamily,
  publicationFamily,
  publicationIdsAtom,
  remember,
  resemblanceFamily,
  rowErrorFamily,
  savedFamily,
  setAll,
  setField,
  totalIndexCountAtom,
} from "./store";

// The two side-effecting seams. Mocking the modules keeps `pages/_app.tsx` and
// the Notifications UI out of the test; the rest (store, model, hashing) is real.
vi.mock("app", () => ({ request: vi.fn() }));
vi.mock("components/Notifications", () => ({ notify: vi.fn() }));

const mockRequest = vi.mocked(request);
const mockNotify = vi.mocked(notify);

type Http = {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
let http: Http;

// A store per test — the remote layer writes the one it is handed.
let store: Store;

function pub(fields: Partial<Publication> = {}): Publication {
  return { ...empty(), ...fields };
}

beforeEach(() => {
  store = createStore();
  vi.clearAllMocks();

  http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
  // By default, `request(op)` runs the op against our fake http client.
  mockRequest.mockImplementation(((op: (client: AxiosInstance) => unknown) =>
    op(http as unknown as AxiosInstance)) as typeof request);
});

describe("bulk", () => {
  test("submits the rows and leaves them in place while the request runs", async () => {
    const [a, b] = [createId(), createId()];
    setAll(store, [
      { id: a, publication: pub({ title: "A" }), errors: null },
      { id: b, publication: pub({ title: "B" }), errors: null },
    ]);
    const created = [pub({ title: "A" })];
    http.post.mockResolvedValue({ data: created });

    const result = await bulk(store);

    expect(http.post).toHaveBeenCalledTimes(1);
    const [url, body] = http.post.mock.calls[0];
    expect(url).toBe("publications/bulk");
    expect(body).toHaveLength(2);
    expect((body as Publication[])[0].title).toBe("A");
    expect(result).toBe(created);
    expect(store.get(publicationIdsAtom)).toEqual([a, b]);
  });

  test("a failed insert leaves the rows as they were", async () => {
    const id = createId();
    setAll(store, [{ id, publication: pub({ title: "A" }), errors: null }]);
    http.post.mockRejectedValue("conflict");

    await expect(bulk(store)).rejects.toBe("conflict");

    expect(store.get(publicationIdsAtom)).toEqual([id]);
    expect(store.get(publicationFamily(id))?.title).toBe("A");
  });
});

describe("update", () => {
  test("PUTs the edited row, replaces it with the server value, and clears the edit", async () => {
    const id = 7;
    remember(store, { ...pub({ title: "Old title" }), id });
    setField(store, id, "title", "New title");
    const returned = { ...pub({ title: "New title" }), id };
    http.put.mockResolvedValue({ data: returned });

    const ok = await update(store, id);

    expect(ok).toBe(true);
    const [url, body] = http.put.mock.calls[0];
    expect(url).toBe("publications/7");
    // The body is the row as edited.
    expect((body as Publication).title).toBe("New title");
    // The row and its saved copy both hold the server's value.
    expect(store.get(publicationFamily(id))).toEqual(returned);
    expect(store.get(savedFamily(id))).toEqual(returned);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "success" }),
    );
  });

  test("on a 409 conflict, notifies and returns false", async () => {
    const id = 7;
    remember(store, { ...pub({ title: "A" }), id });
    http.put.mockRejectedValue({
      response: { status: 409, data: { errors: "conflict" } },
    });

    const ok = await update(store, id);

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning" }),
    );
  });

  test("on a 400, surfaces the field errors on the row and returns false", async () => {
    const id = 7;
    remember(store, { ...pub({ title: "" }), id });
    http.put.mockRejectedValue({
      response: { status: 400, data: { errors: { title: "required" } } },
    });

    const ok = await update(store, id);

    expect(ok).toBe(false);
    expect(store.get(errorFamily(id))).toEqual({ title: "required" });
  });
});

describe("remove", () => {
  test("DELETEs the publication and drops it from the index", async () => {
    hydrate(store, [
      { ...pub({ title: "Doomed" }), id: 7 },
      { ...pub({ title: "Kept" }), id: 12 },
    ]);
    store.set(totalIndexCountAtom, 288);
    http.delete.mockResolvedValue({});

    const ok = await deletePublication(store, {
      ...pub({ title: "Doomed" }),
      id: 7,
    });

    expect(ok).toBe(true);
    expect(http.delete).toHaveBeenCalledWith("publications/7");
    // The row leaves the list, its state resets, and the footer count follows.
    expect(store.get(publicationIdsAtom)).toEqual([12]);
    expect(store.get(publicationFamily(7))).toBeUndefined();
    expect(store.get(totalIndexCountAtom)).toBe(287);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "success" }),
    );
  });

  test("on failure, notifies and leaves the index untouched", async () => {
    hydrate(store, [{ ...pub({ title: "Survivor" }), id: 7 }]);
    store.set(totalIndexCountAtom, 288);
    http.delete.mockRejectedValue({ response: { status: 404 } });

    const ok = await deletePublication(store, {
      ...pub({ title: "Survivor" }),
      id: 7,
    });

    expect(ok).toBe(false);
    expect(store.get(publicationIdsAtom)).toEqual([7]);
    expect(store.get(totalIndexCountAtom)).toBe(288);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning" }),
    );
  });
});

describe("undo", () => {
  test("POSTs the entry to undo, and sends no state of its own", async () => {
    http.post.mockResolvedValue({});

    const ok = await undo(7, 3);

    expect(ok).toBe(true);
    // Names the entry, nothing more: which action compensates it and what state
    // that produces are the server's to decide.
    expect(http.post).toHaveBeenCalledWith("publications/7/history/3/undo");
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "success" }),
    );
  });

  test("a 409 explains that the record has moved on", async () => {
    http.post.mockRejectedValue({ response: { status: 409 } });

    const ok = await undo(7, 3);

    expect(ok).toBe(false);
    // The detail is where the explanation lives — the headline says what
    // failed, the detail says why. Both name their copy; the card writes it.
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warning",
        detail: "notify.undoOutpacedDetail",
      }),
    );
  });
});

describe("restore", () => {
  test("POSTs the restore and notifies success", async () => {
    http.post.mockResolvedValue({ status: 204, data: "" });

    const result = await restore(7);

    expect(result).toEqual({ outcome: "restored" });
    expect(http.post).toHaveBeenCalledWith(
      "publications/7/restore",
      undefined,
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "success" }),
    );
  });

  test("sends the changes to apply before restoring", async () => {
    http.post.mockResolvedValue({ status: 204, data: "" });
    const changes = pub({ title: "Dom Casmurro", year: "1966" });

    await restore(7, changes);

    expect(http.post).toHaveBeenCalledWith(
      "publications/7/restore",
      changes,
      expect.anything(),
    );
  });

  test("a 409 that names the identical publication returns it, without a notice", async () => {
    const twin = { ...pub({ title: "Dom Casmurro" }), id: 8 };
    http.post.mockResolvedValue({
      status: 409,
      data: { error: "conflict", publication: twin },
    });

    const result = await restore(7);

    expect(result).toEqual({ outcome: "identical", twin });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  test("a 409 without a publication explains the record already exists again", async () => {
    http.post.mockResolvedValue({ status: 409, data: { error: "conflict" } });

    const result = await restore(7);

    expect(result).toEqual({ outcome: "failed" });
    // Names the cause and the way out, rather than just failing.
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warning",
        detail: "notify.restoreOutpacedDetail",
      }),
    );
  });

  test("any other refusal is a plain failure", async () => {
    http.post.mockResolvedValue({ status: 409, data: { error: "absorbed" } });

    const result = await restore(7);

    expect(result).toEqual({ outcome: "failed" });
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: "notify.restoreFailed" }),
    );
  });
});

describe("search", () => {
  test("asks the index for the term and answers with its entries", async () => {
    const entries = [pub({ title: "Iracema" })];
    http.get.mockResolvedValue({ data: { entries } });

    const found = await search("iracema");

    expect(http.get).toHaveBeenCalledWith("publications", {
      params: { search: "iracema" },
    });
    expect(found).toBe(entries);
  });

  test("a failed search finds nothing rather than interrupting", async () => {
    http.get.mockRejectedValue(new Error("offline"));

    expect(await search("iracema")).toEqual([]);
    // The view showing the search says so where the results would be.
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe("merge", () => {
  const winner = { ...pub({ title: "Iracema" }), id: 1 };
  const losers = [
    { ...pub({ title: "Iracema" }), id: 2 },
    { ...pub({ title: "Iracema" }), id: 3 },
  ];

  test("names the losers in the body and drops them from the index", async () => {
    hydrate(store, [winner, ...losers]);
    http.post.mockResolvedValue({});

    const ok = await merge(store, { winner, losers });

    expect(ok).toBe(true);
    expect(http.post).toHaveBeenCalledWith("publications/1/merge", {
      losers: [2, 3],
    });
    expect(store.get(publicationIdsAtom)).toEqual([1]);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "success" }),
    );
  });

  test("a 409 explains the merged record would already exist", async () => {
    http.post.mockRejectedValue({ response: { status: 409 } });

    const ok = await merge(store, { winner, losers });

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warning",
        detail: "notify.mergeOutpacedDetail",
      }),
    );
  });
});

describe("validateUpdate", () => {
  test("POSTs the visible value to the row's validate endpoint and surfaces its errors", async () => {
    const id = 7;
    remember(store, { ...pub({ title: "Old title" }), id });
    setField(store, id, "title", "New title");
    http.post.mockResolvedValue({
      data: { publication: pub({ title: "New title" }), errors: "conflict" },
    });

    await validateUpdate(store, id);

    const [url, body] = http.post.mock.calls[0];
    // The id is in the path so the server can exclude the row from its own
    // conflict check.
    expect(url).toBe("publications/7/validate");
    // The body is the row as edited.
    expect((body as Publication).title).toBe("New title");
    expect(store.get(errorFamily(id))).toBe("conflict");
  });

  test("skips the request when nothing changed", async () => {
    const id = 8;
    remember(store, { ...pub({ title: "Dom Casmurro" }), id });
    http.post.mockResolvedValue({
      data: { publication: pub({ title: "Dom Casmurro" }), errors: null },
    });

    // Blur fires this on every field, so an untouched row must not re-ask.
    await validateUpdate(store, id);
    await validateUpdate(store, id);

    expect(http.post).toHaveBeenCalledTimes(1);
  });

  test("clears the row's errors when the edit is valid", async () => {
    const id = 9;
    remember(store, { ...pub({ title: "Dom Casmurro" }), id });
    http.post.mockResolvedValue({
      data: { publication: pub({ title: "Dom Casmurro" }), errors: null },
    });

    await validateUpdate(store, id);

    expect(store.get(errorFamily(id))).toBeNull();
  });
});

describe("validate", () => {
  /**
   * Fills the store with rows that have no stored validation result. `setAll`
   * stores each entry's errors as its result, so the results are removed.
   */
  function unchecked(entries: { id: PublicationId; title: string }[]) {
    setAll(
      store,
      entries.map(({ id, title }) => ({
        id,
        publication: pub({ title }),
        errors: null,
      })),
    );
    Doc.putValidations(
      documentOf(store).doc,
      entries.map(({ id }) => [id, null] as const),
    );
  }

  test("maps each result back to the row it was sent for, not the row's list position", async () => {
    const [a, b, c] = [createId(), createId(), createId()];
    unchecked([
      { id: a, title: "A" },
      { id: b, title: "B" },
      { id: c, title: "C" },
    ]);

    // Pretend B was already validated, so it is filtered out of this run and
    // only A and C are sent.
    store.set(
      lastValidatedFamily(b),
      contentKey(store.get(publicationFamily(b))),
    );

    http.post.mockResolvedValue({
      data: [
        { publication: pub({ title: "A" }), errors: "conflict" },
        { publication: pub({ title: "C" }), errors: "integer" },
      ],
    });

    await validate(store, [a, b, c]);

    // The 2nd result must land on C (the 2nd row *sent*), never B (2nd *listed*).
    expect(store.get(errorFamily(a))).toBe("conflict");
    expect(store.get(errorFamily(c))).toBe("integer");
    expect(store.get(errorFamily(b))).toBeNull();

    // Only the two changed rows were sent.
    const [, sent] = http.post.mock.calls[0];
    expect(sent).toHaveLength(2);
  });

  test("re-sends a row after its value changes and refreshes its error", async () => {
    const a = createId();
    unchecked([{ id: a, title: "" }]);

    // First pass: the server rejects the row.
    http.post.mockResolvedValueOnce({
      data: [{ publication: pub({ title: "" }), errors: "conflict" }],
    });
    await validate(store, [a]);
    expect(store.get(errorFamily(a))).toBe("conflict");

    // The user fixes the row: its value — and therefore its hash — changes, so
    // it is no longer deduplicated against the last validated value.
    setField(store, a, "title", "Dom Casmurro");

    // Second pass: the row is re-sent and its (now clean) result replaces the
    // stale error.
    http.post.mockResolvedValueOnce({
      data: [{ publication: pub({ title: "Dom Casmurro" }), errors: null }],
    });
    await validate(store, [a]);

    expect(http.post).toHaveBeenCalledTimes(2);
    expect(store.get(errorFamily(a))).toBeNull();
  });

  test("skips the request when nothing changed", async () => {
    const a = createId();
    unchecked([{ id: a, title: "A" }]);
    store.set(
      lastValidatedFamily(a),
      contentKey(store.get(publicationFamily(a))),
    );

    await validate(store, [a]);

    expect(http.post).not.toHaveBeenCalled();
  });

  test("reports a failed request and stores no result", async () => {
    const a = createId();
    unchecked([{ id: a, title: "A" }]);
    http.post.mockRejectedValue("boom");

    await expect(validate(store, [a])).rejects.toBe("boom");

    expect(mockNotify).toHaveBeenCalled();
    expect(store.get(isCheckedFamily(a))).toBe(false);
  });

  test("stores each result in the document, for the content that was sent", async () => {
    const a = createId();
    unchecked([{ id: a, title: "" }]);
    const sent = store.get(publicationFamily(a));

    // The server's copy of the row differs from what was sent. The result is
    // still stored for the content that was sent.
    http.post.mockResolvedValue({
      data: [{ publication: pub({ title: "normalised" }), errors: "conflict" }],
    });
    await validate(store, [a]);

    expect(Doc.validationOf(documentOf(store).doc, a)).toEqual({
      content: contentKey(sent),
      errors: "conflict",
    });
  });

  test("skips a row whose content has a stored result, unless forced", async () => {
    const a = createId();
    setAll(store, [
      { id: a, publication: pub({ title: "A" }), errors: "conflict" },
    ]);

    // `setAll` stored the entry's errors as the result for its content.
    await validate(store, [a]);
    expect(http.post).not.toHaveBeenCalled();

    http.post.mockResolvedValue({
      data: [{ publication: pub({ title: "A" }), errors: null }],
    });
    await validate(store, [a], { force: true });

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(store.get(errorFamily(a))).toBeNull();
  });

  test("leaves out a row the store does not hold", async () => {
    await validate(store, [createId()]);

    expect(http.post).not.toHaveBeenCalled();
  });
});

describe("resemblances", () => {
  test("names the rows of each entry by id, the repeated row included", async () => {
    const [a, b, c] = [createId(), createId(), createId()];
    const row = { title: "Dom Casmurro", authors: ["Helen Caldwell"] };
    setAll(store, [
      { id: a, publication: pub(row), errors: null },
      { id: b, publication: pub({ title: "Iracema" }), errors: null },
      { id: c, publication: pub(row), errors: null },
    ]);
    http.post.mockResolvedValue({
      data: {
        entries: [
          { position: 0, stored: [], others: [2], repeats: null },
          { position: 2, stored: [], others: [0], repeats: 0 },
        ],
      },
    });

    await resemblances(store, [a, b, c]);

    expect(store.get(resemblanceFamily(a))).toEqual({
      stored: [],
      others: [c],
      repeats: null,
    });
    expect(store.get(resemblanceFamily(b))).toBeNull();
    expect(store.get(resemblanceFamily(c))?.repeats).toBe(a);
    expect(store.get(rowErrorFamily(c))).toBe("repeated");
  });
});

describe("upload", () => {
  test("adds the server's rows after the ones already in the working set", async () => {
    const old = createId();
    setAll(store, [
      { id: old, publication: pub({ title: "old" }), errors: null },
    ]);

    http.post.mockResolvedValue({
      data: [
        { publication: pub({ title: "New A" }), errors: null },
        { publication: pub({ title: "New B" }), errors: "conflict" },
      ],
    });

    await upload(store, new FormData());

    const ids = store.get(publicationIdsAtom)!;
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(old);
    expect(store.get(publicationFamily(ids[1])).title).toBe("New A");
    expect(store.get(errorFamily(ids[2]))).toBe("conflict");
    expect(http.post).toHaveBeenCalledWith(
      "publications/validate",
      expect.any(FormData),
    );
  });

  test("one undo takes the uploaded rows out again", async () => {
    const old = createId();
    setAll(store, [
      { id: old, publication: pub({ title: "old" }), errors: null },
    ]);
    http.post.mockResolvedValue({
      data: [{ publication: pub({ title: "New A" }), errors: null }],
    });

    await upload(store, new FormData());
    documentOf(store).undo.undo();

    expect(store.get(publicationIdsAtom)).toEqual([old]);
  });

  test("a failed upload leaves the rows as they were", async () => {
    const old = createId();
    setAll(store, [
      { id: old, publication: pub({ title: "old" }), errors: null },
    ]);
    http.post.mockRejectedValue("boom");

    await expect(upload(store, new FormData())).rejects.toBe("boom");

    expect(store.get(publicationIdsAtom)).toEqual([old]);
  });
});

describe("run (error handling)", () => {
  test("names the error's copy and re-throws on failure", async () => {
    mockRequest.mockRejectedValueOnce("conflict");

    await expect(bulk(store)).rejects.toBe("conflict");

    expect(mockNotify).toHaveBeenCalledWith({
      message: "publicationError.conflict",
      level: "warning",
    });
  });
});

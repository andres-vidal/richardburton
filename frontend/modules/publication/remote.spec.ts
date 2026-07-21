import { request } from "app";
import type { AxiosInstance } from "axios";
import { notify } from "components/Notifications";
import hash from "object-hash";

import type { Publication } from "./model";
import { empty } from "./model";
import {
  bulk,
  index,
  update,
  upload,
  validate,
  validateUpdate,
} from "./remote";
import {
  createId,
  errorFamily,
  isIndexLoadingAtom,
  isValidatingAtom,
  keywordsAtom,
  lastValidatedFamily,
  overrideFamily,
  overrideField,
  publicationFamily,
  publicationIdsAtom,
  resetAll,
  setAll,
  store,
  totalIndexCountAtom,
  visiblePublicationFamily,
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
};
let http: Http;

function pub(fields: Partial<Publication> = {}): Publication {
  return { ...empty(), ...fields };
}

beforeEach(() => {
  resetAll();
  store.set(isValidatingAtom, false);
  vi.clearAllMocks();

  http = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
  // By default, `request(op)` runs the op against our fake http client.
  mockRequest.mockImplementation(((op: (client: AxiosInstance) => unknown) =>
    op(http as unknown as AxiosInstance)) as typeof request);
});

describe("index", () => {
  test("loads entries, keywords and the total count", async () => {
    http.get.mockResolvedValue({
      data: {
        entries: [
          pub({ title: "Dom Casmurro", id: 7 }),
          pub({ title: "The Hour of the Star", id: 12 }),
        ],
        keywords: ["machado"],
      },
      headers: { "rb-total-count": "42" },
    });

    await index();

    const ids = store.get(publicationIdsAtom);
    expect(ids).toEqual([7, 12]);
    expect(store.get(publicationFamily(ids![0])).title).toBe("Dom Casmurro");
    expect(store.get(publicationFamily(ids![1])).title).toBe(
      "The Hour of the Star",
    );
    expect(store.get(totalIndexCountAtom)).toBe(42);
    expect(store.get(keywordsAtom)).toEqual(["machado"]);
    expect(http.get).toHaveBeenCalledWith("publications");
  });

  test("appends the search term to the query", async () => {
    http.get.mockResolvedValue({
      data: { entries: [], keywords: [] },
      headers: {},
    });

    await index({ search: "Machado" });

    expect(http.get).toHaveBeenCalledWith("publications?search=Machado");
  });

  test("keeps the previous rows on screen until the new results arrive", async () => {
    const [a, b] = [createId(), createId()];
    setAll([
      { id: a, publication: pub({ title: "Old A" }), errors: null },
      { id: b, publication: pub({ title: "Old B" }), errors: null },
    ]);

    // Defer the response so we can inspect the store mid-fetch.
    let resolve!: (value: unknown) => void;
    http.get.mockReturnValue(new Promise((r) => (resolve = r)));

    store.set(isIndexLoadingAtom, true);
    const pending = index({ search: "new" });

    // Mid-fetch: the old ids are still there — no reset-to-undefined, so the
    // table shows the stale rows instead of blinking the skeleton.
    expect(store.get(publicationIdsAtom)).toEqual([a, b]);

    resolve({
      data: { entries: [pub({ title: "New" })], keywords: [] },
      headers: {},
    });
    await pending;

    // The new results replace the old ones, and loading is cleared.
    const ids = store.get(publicationIdsAtom);
    expect(ids).toHaveLength(1);
    expect(store.get(publicationFamily(ids![0])).title).toBe("New");
    expect(store.get(isIndexLoadingAtom)).toBe(false);
  });
});

describe("index({ unreferenced })", () => {
  test("loads the reference-less publications and returns their ids", async () => {
    http.get.mockResolvedValue({
      data: {
        entries: [
          pub({ title: "Dom Casmurro", id: 7 }),
          pub({ title: "The Hour of the Star", id: 12 }),
        ],
      },
      headers: {},
    });

    const ids = await index({ unreferenced: true });

    expect(http.get).toHaveBeenCalledWith("publications?unreferenced");
    expect(ids).toEqual([7, 12]);
    expect(store.get(publicationIdsAtom)).toEqual([7, 12]);
    expect(store.get(publicationFamily(7)).title).toBe("Dom Casmurro");
    expect(store.get(publicationFamily(12)).title).toBe("The Hour of the Star");
  });
});

describe("bulk", () => {
  test("submits the visible working set and clears the list", async () => {
    const [a, b] = [createId(), createId()];
    setAll([
      { id: a, publication: pub({ title: "A" }), errors: null },
      { id: b, publication: pub({ title: "B" }), errors: null },
    ]);
    const created = [pub({ title: "A" })];
    http.post.mockResolvedValue({ data: created });

    const result = await bulk();

    expect(http.post).toHaveBeenCalledTimes(1);
    const [url, body] = http.post.mock.calls[0];
    expect(url).toBe("publications/bulk");
    expect(body).toHaveLength(2);
    expect((body as Publication[])[0].title).toBe("A");
    expect(result).toBe(created);
    // The list is reset while the server responds.
    expect(store.get(publicationIdsAtom)).toBeUndefined();
  });
});

describe("update", () => {
  test("PUTs the edited row, replaces it with the server value, and clears the edit", async () => {
    const id = 7;
    store.set(publicationFamily(id), pub({ title: "Old title" }));
    overrideField(id, "title", "New title");
    const returned = { ...pub({ title: "New title" }), id };
    http.put.mockResolvedValue({ data: returned });

    const ok = await update(id);

    expect(ok).toBe(true);
    const [url, body] = http.put.mock.calls[0];
    expect(url).toBe("publications/7");
    // The body is the visible value (base ⊕ pending edit).
    expect((body as Publication).title).toBe("New title");
    // The row is replaced with the server's value and the edit is cleared.
    expect(store.get(publicationFamily(id))).toEqual(returned);
    expect(store.get(overrideFamily(id))).toBeUndefined();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "success" }),
    );
  });

  test("on a 409 conflict, notifies and returns false", async () => {
    const id = 7;
    store.set(publicationFamily(id), pub({ title: "A" }));
    http.put.mockRejectedValue({
      response: { status: 409, data: { errors: "conflict" } },
    });

    const ok = await update(id);

    expect(ok).toBe(false);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning" }),
    );
  });

  test("on a 400, surfaces the field errors on the row and returns false", async () => {
    const id = 7;
    store.set(publicationFamily(id), pub({ title: "" }));
    http.put.mockRejectedValue({
      response: { status: 400, data: { errors: { title: "required" } } },
    });

    const ok = await update(id);

    expect(ok).toBe(false);
    expect(store.get(errorFamily(id))).toEqual({ title: "required" });
  });
});

describe("validateUpdate", () => {
  test("POSTs the visible value to the row's validate endpoint and surfaces its errors", async () => {
    const id = 7;
    store.set(publicationFamily(id), pub({ title: "Old title" }));
    overrideField(id, "title", "New title");
    http.post.mockResolvedValue({
      data: { publication: pub({ title: "New title" }), errors: "conflict" },
    });

    await validateUpdate(id);

    const [url, body] = http.post.mock.calls[0];
    // The id is in the path so the server can exclude the row from its own
    // conflict check.
    expect(url).toBe("publications/7/validate");
    // The body is the visible value (base ⊕ pending edit).
    expect((body as Publication).title).toBe("New title");
    expect(store.get(errorFamily(id))).toBe("conflict");
  });

  // Each test uses its own id: these rows are written straight to
  // `publicationFamily`, so they never enter `publicationIdsAtom` and `resetAll`
  // can't clear them between tests.
  test("skips the request when nothing changed", async () => {
    const id = 8;
    store.set(publicationFamily(id), pub({ title: "Dom Casmurro" }));
    http.post.mockResolvedValue({
      data: { publication: pub({ title: "Dom Casmurro" }), errors: null },
    });

    // Blur fires this on every field, so an untouched row must not re-ask.
    await validateUpdate(id);
    await validateUpdate(id);

    expect(http.post).toHaveBeenCalledTimes(1);
  });

  test("clears the row's errors when the edit is valid", async () => {
    const id = 9;
    store.set(publicationFamily(id), pub({ title: "Dom Casmurro" }));
    http.post.mockResolvedValue({
      data: { publication: pub({ title: "Dom Casmurro" }), errors: null },
    });

    await validateUpdate(id);

    expect(store.get(errorFamily(id))).toBeNull();
  });
});

describe("validate", () => {
  test("maps each result back to the row it was sent for, not the row's list position", async () => {
    const [a, b, c] = [createId(), createId(), createId()];
    setAll([
      { id: a, publication: pub({ title: "A" }), errors: null },
      { id: b, publication: pub({ title: "B" }), errors: null },
      { id: c, publication: pub({ title: "C" }), errors: null },
    ]);

    // Pretend B was already validated, so it is filtered out of this run and
    // only A and C are sent.
    store.set(
      lastValidatedFamily(b),
      hash(store.get(visiblePublicationFamily(b))),
    );

    http.post.mockResolvedValue({
      data: [
        { publication: pub({ title: "A" }), errors: "conflict" },
        { publication: pub({ title: "C" }), errors: "integer" },
      ],
    });

    await validate([a, b, c]);

    // The 2nd result must land on C (the 2nd row *sent*), never B (2nd *listed*).
    expect(store.get(errorFamily(a))).toBe("conflict");
    expect(store.get(errorFamily(c))).toBe("integer");
    expect(store.get(errorFamily(b))).toBeNull();

    // Only the two changed rows were sent.
    const [, sent] = http.post.mock.calls[0];
    expect(sent).toHaveLength(2);
    expect(store.get(isValidatingAtom)).toBe(false);
  });

  test("re-sends a row after its value changes and refreshes its error", async () => {
    const a = createId();
    setAll([{ id: a, publication: pub({ title: "" }), errors: null }]);

    // First pass: the server rejects the row.
    http.post.mockResolvedValueOnce({
      data: [{ publication: pub({ title: "" }), errors: "conflict" }],
    });
    await validate([a]);
    expect(store.get(errorFamily(a))).toBe("conflict");

    // The user fixes the row: its value — and therefore its hash — changes, so
    // it is no longer deduplicated against the last validated value.
    store.set(publicationFamily(a), pub({ title: "Dom Casmurro" }));

    // Second pass: the row is re-sent and its (now clean) result replaces the
    // stale error.
    http.post.mockResolvedValueOnce({
      data: [{ publication: pub({ title: "Dom Casmurro" }), errors: null }],
    });
    await validate([a]);

    expect(http.post).toHaveBeenCalledTimes(2);
    expect(store.get(errorFamily(a))).toBeNull();
  });

  test("skips the request when nothing changed", async () => {
    const a = createId();
    setAll([{ id: a, publication: pub({ title: "A" }), errors: null }]);
    store.set(
      lastValidatedFamily(a),
      hash(store.get(visiblePublicationFamily(a))),
    );

    await validate([a]);

    expect(http.post).not.toHaveBeenCalled();
    expect(store.get(isValidatingAtom)).toBe(false);
  });

  test("clears the validating flag even when the request fails", async () => {
    const a = createId();
    setAll([{ id: a, publication: pub({ title: "A" }), errors: null }]);
    http.post.mockRejectedValue("boom");

    await expect(validate([a])).rejects.toBe("boom");

    expect(store.get(isValidatingAtom)).toBe(false);
    expect(mockNotify).toHaveBeenCalled();
  });
});

describe("upload", () => {
  test("replaces the working set from the server's validation", async () => {
    const old = createId();
    setAll([{ id: old, publication: pub({ title: "old" }), errors: null }]);

    http.post.mockResolvedValue({
      data: [
        { publication: pub({ title: "New A" }), errors: null },
        { publication: pub({ title: "New B" }), errors: "conflict" },
      ],
    });

    await upload(new FormData());

    const ids = store.get(publicationIdsAtom);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(old);
    expect(store.get(publicationFamily(ids![0])).title).toBe("New A");
    expect(store.get(errorFamily(ids![1]))).toBe("conflict");
    expect(http.post).toHaveBeenCalledWith(
      "publications/validate",
      expect.any(FormData),
    );
  });
});

describe("run (error handling)", () => {
  test("notifies with a friendly message and re-throws on failure", async () => {
    mockRequest.mockRejectedValueOnce("conflict");

    await expect(index()).rejects.toBe("conflict");

    expect(mockNotify).toHaveBeenCalledWith({
      message: "A publication with this data already exists",
      level: "warning",
    });
  });
});

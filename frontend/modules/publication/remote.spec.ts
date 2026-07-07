import { request } from "app";
import type { AxiosInstance } from "axios";
import { notify } from "components/Notifications";
import hash from "object-hash";

import { empty } from "./model";
import type { Publication } from "./model";
import {
  createId,
  errorFamily,
  isValidatingAtom,
  keywordsAtom,
  lastValidatedFamily,
  publicationFamily,
  publicationIdsAtom,
  resetAll,
  setAll,
  store,
  totalIndexCountAtom,
  visiblePublicationFamily,
} from "./store";
import { bulk, index, upload, validate } from "./remote";

// The two side-effecting seams. Mocking the modules keeps `pages/_app.tsx` and
// the Notifications UI out of the test; the rest (store, model, hashing) is real.
vi.mock("app", () => ({ request: vi.fn() }));
vi.mock("components/Notifications", () => ({ notify: vi.fn() }));

const mockRequest = vi.mocked(request);
const mockNotify = vi.mocked(notify);

type Http = { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
let http: Http;

function pub(fields: Partial<Publication> = {}): Publication {
  return { ...empty(), ...fields };
}

beforeEach(() => {
  resetAll();
  store.set(isValidatingAtom, false);
  vi.clearAllMocks();

  http = { get: vi.fn(), post: vi.fn() };
  // By default, `request(op)` runs the op against our fake http client.
  mockRequest.mockImplementation(((op: (client: AxiosInstance) => unknown) =>
    op(http as unknown as AxiosInstance)) as typeof request);
});

describe("index", () => {
  test("loads entries, keywords and the total count", async () => {
    http.get.mockResolvedValue({
      data: {
        entries: [
          pub({ title: "Dom Casmurro" }),
          pub({ title: "The Hour of the Star" }),
        ],
        keywords: ["machado"],
      },
      headers: { xTotalCount: "42" },
    });

    await index();

    const ids = store.get(publicationIdsAtom);
    expect(ids).toHaveLength(2);
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

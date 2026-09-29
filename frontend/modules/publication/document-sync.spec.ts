import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as Y from "yjs";

import * as Doc from "./doc";
import { empty } from "./model";
import * as Remote from "./document-remote";
import { RETRY_MS, SETTLE_MS, sync } from "./document-sync";

const row = (title: string) => ({ ...empty(), title });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Advances fake time past `SETTLE_MS` and lets the resulting post finish. */
async function settle() {
  await vi.advanceTimersByTimeAsync(SETTLE_MS + 1);
}

/** Advances fake time past `RETRY_MS`, the delay before the first retry. */
async function retry() {
  await vi.advanceTimersByTimeAsync(RETRY_MS + 1);
}

describe("opening", () => {
  test("applies everything the server holds", async () => {
    const held = new Y.Doc();
    Doc.addRow(held, "a", row("Dom Casmurro"));

    vi.spyOn(Remote, "updates").mockResolvedValue({
      updates: [Y.encodeStateAsUpdate(held)],
      through: 1,
    });
    vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    expect(Doc.readRow(doc, "a")?.title).toBe("Dom Casmurro");

    running.stop();
  });

  test("what arrived from the server is not posted back", async () => {
    const held = new Y.Doc();
    Doc.addRow(held, "a", row("Dom Casmurro"));

    vi.spyOn(Remote, "updates").mockResolvedValue({
      updates: [Y.encodeStateAsUpdate(held)],
      through: 1,
    });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;
    await settle();

    // Updates applied from the server are not local changes.
    expect(posted).not.toHaveBeenCalled();

    running.stop();
  });

  test("what arrived from the server is not this person's to undo", async () => {
    const held = new Y.Doc();
    Doc.addRow(held, "a", row("Dom Casmurro"));

    vi.spyOn(Remote, "updates").mockResolvedValue({
      updates: [Y.encodeStateAsUpdate(held)],
      through: 1,
    });
    vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const undo = Doc.undoManager(doc);
    const running = sync(doc, 1);
    await running.ready;

    expect(undo.undoStack).toHaveLength(0);

    running.stop();
  });
});

describe("posting what is changed here", () => {
  test("a change made here is posted, with the row count", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 7);
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    expect(posted).toHaveBeenCalledTimes(1);

    const [id, , rows] = posted.mock.calls[0];
    expect(id).toBe(7);
    expect(rows).toBe(1);

    running.stop();
  });

  test("a burst of changes is one request, not one each", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmuro"));
    Doc.setField(doc, "a", "title", "Dom Casmurr");
    Doc.setField(doc, "a", "title", "Dom Casmurro");
    await settle();

    expect(posted).toHaveBeenCalledTimes(1);

    // The one update holds the result of all three changes.
    const elsewhere = new Y.Doc();
    Y.applyUpdate(elsewhere, posted.mock.calls[0][1]);
    expect(Doc.readRow(elsewhere, "a")?.title).toBe("Dom Casmurro");

    running.stop();
  });

  test("a post that fails is carried by the next one", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi
      .spyOn(Remote, "append")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    // The first post failed.
    expect(posted).toHaveBeenCalledTimes(1);

    Doc.addRow(doc, "b", row("Iracema"));
    await retry();

    expect(posted).toHaveBeenCalledTimes(2);

    // The second post holds both rows, including the one from the failed post.
    const elsewhere = new Y.Doc();
    Y.applyUpdate(elsewhere, posted.mock.calls[1][1]);
    expect(Doc.keys(elsewhere).sort()).toEqual(["a", "b"]);

    running.stop();
  });

  test("nothing is posted once it has stopped", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    running.stop();
    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    expect(posted).not.toHaveBeenCalled();
  });
});

describe("work that only this machine holds", () => {
  // Simulates a document restored from IndexedDB: it holds content applied
  // with an origin that is not local.
  const fromDisk = (doc: Y.Doc, title: string) => {
    const disk = new Y.Doc();
    Doc.addRow(disk, "a", row(title));

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(disk), "disk");
  };

  test("is offered to the server on opening", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    fromDisk(doc, "Dom Casmurro");

    const running = sync(doc, 1);
    await running.ready;
    await settle();

    expect(posted).toHaveBeenCalledTimes(1);

    const elsewhere = new Y.Doc();
    Y.applyUpdate(elsewhere, posted.mock.calls[0][1]);
    expect(Doc.readRow(elsewhere, "a")?.title).toBe("Dom Casmurro");

    running.stop();
  });

  test("nothing is offered where the server already holds everything", async () => {
    const held = new Y.Doc();
    Doc.addRow(held, "a", row("Dom Casmurro"));

    vi.spyOn(Remote, "updates").mockResolvedValue({
      updates: [Y.encodeStateAsUpdate(held)],
      through: 3,
    });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;
    await settle();

    expect(posted).not.toHaveBeenCalled();

    running.stop();
  });
});

describe("saying where the work stands", () => {
  test("saving while there is something to post, saved once there is not", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const seen: string[] = [];
    const doc = new Y.Doc();
    const running = sync(doc, 1, { onStatus: (state) => seen.push(state) });

    await running.ready;
    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    expect(seen).toEqual(["saving", "saved"]);

    running.stop();
  });

  test("offline while a post keeps failing, and saved once one lands", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    vi.spyOn(Remote, "append")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);

    const seen: string[] = [];
    const doc = new Y.Doc();
    const running = sync(doc, 1, { onStatus: (state) => seen.push(state) });
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    expect(seen).toEqual(["saving", "offline"]);

    await retry();

    expect(seen).toEqual(["saving", "offline", "saved"]);

    running.stop();
  });

  test("a failed post is tried again without anyone typing", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi
      .spyOn(Remote, "append")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();
    expect(posted).toHaveBeenCalledTimes(1);

    // No further edit is made. The retry has to run on its own, since the
    // person may have finished editing.
    await retry();

    expect(posted).toHaveBeenCalledTimes(2);

    running.stop();
  });
});

describe("what it says while somebody types", () => {
  test("a keystroke that changes nothing is not reported again", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const seen: string[] = [];
    const doc = new Y.Doc();
    const running = sync(doc, 1, { onStatus: (state) => seen.push(state) });

    await running.ready;

    // Three changes in a row report `saving` once. Every reader of the status
    // re-renders on each report.
    Doc.addRow(doc, "a", row("Dom"));
    Doc.addRow(doc, "b", row("Casmurro"));
    Doc.addRow(doc, "c", row("Iracema"));

    expect(seen).toEqual(["saving"]);

    await settle();
    expect(seen).toEqual(["saving", "saved"]);

    running.stop();
  });
});

describe("walking a change back", () => {
  // An undo has the `Y.UndoManager` as its origin, not `LOCAL`. If only `LOCAL`
  // changes were posted, the undo would never reach the server, and the status
  // would still say `saved`.
  test("an undo is posted, the same as the edit it takes back", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const undo = Doc.undoManager(doc);
    const running = sync(doc, 1);
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();
    undo.stopCapturing();

    undo.undo();
    await settle();

    expect(posted).toHaveBeenCalledTimes(2);

    // Applying every posted update gives a document without the row.
    const elsewhere = new Y.Doc();
    posted.mock.calls.forEach(([, update]) => Y.applyUpdate(elsewhere, update));
    expect(Doc.keys(elsewhere)).toEqual([]);

    running.stop();
  });
});

describe("work read from this browser's disk", () => {
  // The IndexedDB copy and the server's updates load at the same time. What
  // the server lacks is worked out after both have loaded, so offline work is
  // posted even when IndexedDB finishes last.
  test("is offered even when it loads after the server has answered", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    let finishLoading = () => {};
    const loaded = new Promise<void>((resolve) => {
      finishLoading = resolve;
    });

    const running = sync(doc, 1, { loaded });

    // The server answers first, and the IndexedDB copy loads afterwards.
    await vi.advanceTimersByTimeAsync(0);
    const disk = new Y.Doc();
    Doc.addRow(disk, "a", row("Dom Casmurro"));
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(disk), "disk");
    finishLoading();

    await running.ready;
    await settle();

    expect(posted).toHaveBeenCalledTimes(1);

    running.stop();
  });
});

describe("coming back after being away", () => {
  test("reads only what was stored since the last read, and applies it", async () => {
    const held = new Y.Doc();
    Doc.addRow(held, "a", row("Dom Casmurro"));

    const read = vi.spyOn(Remote, "updates").mockResolvedValueOnce({
      updates: [Y.encodeStateAsUpdate(held)],
      through: 5,
    });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    // Another client adds a row while this client is disconnected from the
    // channel.
    const before = Y.encodeStateVector(held);
    Doc.addRow(held, "b", row("Iracema"));
    read.mockResolvedValueOnce({
      updates: [Y.encodeStateAsUpdate(held, before)],
      through: 7,
    });

    await running.resync();

    expect(read).toHaveBeenLastCalledWith(1, 5);
    expect(Doc.readRow(doc, "b")?.title).toBe("Iracema");

    // What came from the server is not posted back to it.
    await settle();
    expect(posted).not.toHaveBeenCalled();

    // The next resync reads from the `through` of this one.
    read.mockResolvedValueOnce({ updates: [], through: 7 });
    await running.resync();
    expect(read).toHaveBeenLastCalledWith(1, 7);

    running.stop();
  });

  // Until a read has succeeded there is no `through` to read from, and work
  // restored from IndexedDB has not been posted yet.
  test("before a first read has succeeded, it reads everything and offers what only this machine holds", async () => {
    const read = vi
      .spyOn(Remote, "updates")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const disk = new Y.Doc();
    Doc.addRow(disk, "a", row("Dom Casmurro"));
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(disk), "disk");

    const running = sync(doc, 1);
    await expect(running.ready).rejects.toThrow("offline");

    await running.resync();
    await settle();

    expect(read).toHaveBeenLastCalledWith(1);
    expect(posted).toHaveBeenCalledTimes(1);

    running.stop();
  });
});

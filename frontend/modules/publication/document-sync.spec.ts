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

/** Let the gather window pass and the post that follows it settle. */
async function settle() {
  await vi.advanceTimersByTimeAsync(SETTLE_MS + 1);
}

/** Let the wait before a failed post is tried again pass. */
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

    // Applying it is not a change this person made.
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

    // And the one update says everything the three did.
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

    // The first attempt failed, and nothing was lost by it.
    expect(posted).toHaveBeenCalledTimes(1);

    Doc.addRow(doc, "b", row("Iracema"));
    await retry();

    expect(posted).toHaveBeenCalledTimes(2);

    // The second request carries both rows, including the one that failed.
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
  // What a document restored from this browser's disk looks like: content the
  // document holds that was never stamped as a local change, because applying
  // it was not one.
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

    // Nobody types. The person may have stopped precisely because they had
    // finished, and what they wrote is still not on the server.
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

    // A burst of typing is one thing to say, not one per character: every
    // reader of the status re-renders for each thing said.
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
  // An undo is stamped with the undo manager that made it rather than with the
  // origin of the edit it reverses. Posting only what is stamped as an edit is
  // how an undo would happen on one screen and nowhere else, while the status
  // went on saying the work was saved.
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

    // What the server was sent adds up to a document without the row.
    const elsewhere = new Y.Doc();
    posted.mock.calls.forEach(([, update]) => Y.applyUpdate(elsewhere, update));
    expect(Doc.keys(elsewhere)).toEqual([]);

    running.stop();
  });
});

describe("work read from this browser's disk", () => {
  // The disk copy and the server's copy load at once. What the server lacks is
  // measured after both, so that offline work that happens to load second is
  // still part of what is offered.
  test("is offered even when it loads after the server has answered", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    const posted = vi.spyOn(Remote, "append").mockResolvedValue(undefined);

    const doc = new Y.Doc();
    let finishLoading = () => {};
    const loaded = new Promise<void>((resolve) => {
      finishLoading = resolve;
    });

    const running = sync(doc, 1, { loaded });

    // The server answers first; the disk copy arrives afterwards.
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

    // Somebody else adds a row while this client cannot hear the relay.
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

    // And the next time it reads on from where this one reached.
    read.mockResolvedValueOnce({ updates: [], through: 7 });
    await running.resync();
    expect(read).toHaveBeenLastCalledWith(1, 7);

    running.stop();
  });

  // Until one read has succeeded there is no point to read on from, and work
  // restored from disk has not been offered to the server yet.
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

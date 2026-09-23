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
    const running = sync(doc, 1, (status) => seen.push(status.state));

    await running.ready;
    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    expect(seen).toEqual(["saving", "saved"]);
    expect(running.status().savedAt).toBeDefined();

    running.stop();
  });

  test("offline while a post keeps failing, and saved once one lands", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue({ updates: [], through: 0 });
    vi.spyOn(Remote, "append")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);

    const doc = new Y.Doc();
    const running = sync(doc, 1);
    await running.ready;

    Doc.addRow(doc, "a", row("Dom Casmurro"));
    await settle();

    expect(running.status().state).toBe("offline");
    expect(running.status().failures).toBe(1);

    await retry();

    expect(running.status().state).toBe("saved");
    expect(running.status().failures).toBe(0);

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

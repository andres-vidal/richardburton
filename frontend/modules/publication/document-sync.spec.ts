import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as Y from "yjs";

import * as Doc from "./doc";
import { empty } from "./model";
import * as Remote from "./document-remote";
import { SETTLE_MS, sync } from "./document-sync";

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

describe("opening", () => {
  test("applies everything the server holds", async () => {
    const held = new Y.Doc();
    Doc.addRow(held, "a", row("Dom Casmurro"));

    vi.spyOn(Remote, "updates").mockResolvedValue([
      Y.encodeStateAsUpdate(held),
    ]);
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

    vi.spyOn(Remote, "updates").mockResolvedValue([
      Y.encodeStateAsUpdate(held),
    ]);
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

    vi.spyOn(Remote, "updates").mockResolvedValue([
      Y.encodeStateAsUpdate(held),
    ]);
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
    vi.spyOn(Remote, "updates").mockResolvedValue([]);
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
    vi.spyOn(Remote, "updates").mockResolvedValue([]);
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
    vi.spyOn(Remote, "updates").mockResolvedValue([]);
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
    await settle();

    expect(posted).toHaveBeenCalledTimes(2);

    // The second request carries both rows, including the one that failed.
    const elsewhere = new Y.Doc();
    Y.applyUpdate(elsewhere, posted.mock.calls[1][1]);
    expect(Doc.keys(elsewhere).sort()).toEqual(["a", "b"]);

    running.stop();
  });

  test("nothing is posted once it has stopped", async () => {
    vi.spyOn(Remote, "updates").mockResolvedValue([]);
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

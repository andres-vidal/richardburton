import * as Y from "yjs";

import { LOCAL, keys } from "./doc";
import { append, compact, updates } from "./document-remote";

/**
 * The origin stamped on a change that came from the server.
 *
 * It is what stops the client posting back what the server just gave it, and it
 * keeps such a change out of undo: arriving from elsewhere is not something a
 * person did here.
 */
const REMOTE = Symbol("remote");

/** How long to gather changes before posting them, in milliseconds. */
const SETTLE_MS = 400;

/** How long to wait before trying a failed post again, and the ceiling on it. */
const RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * How many stored updates are worth merging into one.
 *
 * A document is read by applying every update ever written to it, so one kept
 * for months opens slowly. Merging is only worth its round trip once there are
 * enough of them to notice.
 */
const COMPACT_ABOVE = 200;

/**
 * Where a document's work stands with the server.
 *
 * `saving` means there is something written here the server has not taken yet.
 * `offline` means a post has failed and is being retried, which is a different
 * thing to say than `saving`: the work is safe on this machine either way, but
 * only one of the two is on its way anywhere.
 */
type SyncState = "saved" | "saving" | "offline";

type Status = {
  state: SyncState;
  /** When the server last took everything written here, if it ever has. */
  savedAt?: number;
  /** How many attempts have failed in a row, which is what paces the retry. */
  failures: number;
};

type Sync = {
  /** Everything the server holds has been applied, and anything only this machine held has been offered to it. */
  ready: Promise<void>;
  status: () => Status;
  /**
   * Read the stored updates again and apply what is missing.
   *
   * For coming back after being away. Changes are relayed and not stored, so
   * the ones made while this client was unreachable were heard by everyone
   * else and are nowhere in the relay to be asked for.
   */
  resync: () => Promise<void>;
  stop: () => void;
};

/**
 * Keep a document and the server's copy of it in step.
 *
 * On opening, everything the server holds is applied, and anything this machine
 * holds that the server does not is posted — work done with the server
 * unreachable is on disk rather than in the post queue, so without this it
 * would stay on the one machine for good.
 *
 * After that, each change made here is posted as the opaque bytes it is.
 * Changes are gathered for a moment first, so a burst of typing is one request
 * rather than one per keystroke — Yjs merges them into a single update that
 * means the same thing.
 *
 * Only changes made here are posted. A change that arrived from the server
 * carries its own origin, so applying it cannot start a round trip back.
 *
 * Nothing here blocks editing. The document needs no authority to accept a
 * change, so a slow connection makes the document save late rather than stall.
 * A post that fails is tried again on a widening delay rather than waiting for
 * the next keystroke, since the person may have stopped typing precisely
 * because they were finished.
 */
function sync(
  doc: Y.Doc,
  id: number,
  onStatus?: (status: Status) => void,
): Sync {
  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let status: Status = { state: "saved", failures: 0 };

  const report = (next: Partial<Status>) => {
    status = { ...status, ...next };
    onStatus?.(status);
  };

  /** How long to wait after this many failures, doubling up to the ceiling. */
  const backoff = (failures: number) =>
    Math.min(RETRY_MS * 2 ** Math.max(failures - 1, 0), MAX_RETRY_MS);

  const schedule = (delay: number) => {
    if (stopped || timer !== undefined) return;

    timer = setTimeout(flush, delay);
  };

  const flush = async () => {
    timer = undefined;

    const sending = pending;
    pending = [];

    if (sending.length === 0 || stopped) return;

    try {
      // One update standing for all of them, which is what the server would
      // have held anyway had they arrived separately.
      await append(id, Y.mergeUpdates(sending), keys(doc).length);

      if (stopped) return;

      report({
        state: pending.length > 0 ? "saving" : "saved",
        savedAt: Date.now(),
        failures: 0,
      });

      if (pending.length > 0) schedule(SETTLE_MS);
    } catch {
      // The change is still in the document, so the next post carries it. A
      // document that cannot reach the server is one being edited offline, not
      // one that has lost anything.
      pending = [...sending, ...pending];

      if (stopped) return;

      const failures = status.failures + 1;
      report({ state: "offline", failures });
      schedule(backoff(failures));
    }
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== LOCAL) return;

    pending.push(update);
    if (status.state !== "offline") report({ state: "saving" });
    schedule(SETTLE_MS);
  };

  /**
   * Hand the server what only this machine holds.
   *
   * What came back from the server is applied under the remote origin, so none
   * of it is posted back. Anything the document holds beyond that was written
   * here while the server was out of reach and restored from this browser's
   * disk, which carries its own origin too — so nothing else would ever offer
   * it, and it would stay on this machine.
   */
  const reconcile = async () => {
    const held = await updates(id);

    // What the server holds, measured before applying it, so the difference
    // afterwards is exactly what it is missing.
    const theirs = new Y.Doc();
    held.updates.forEach((update) => Y.applyUpdate(theirs, update, REMOTE));
    const known = Y.encodeStateVector(theirs);
    theirs.destroy();

    held.updates.forEach((update) => Y.applyUpdate(doc, update, REMOTE));

    if (stopped) return;

    const missing = Y.encodeStateAsUpdate(doc, known);

    if (holdsSomething(missing)) {
      pending.push(missing);
      report({ state: "saving" });
      schedule(0);
    }

    // A document read as hundreds of updates is one nobody has merged. Doing it
    // here rather than on a timer means it happens where the cost was just
    // paid, and at most once per opening.
    if (held.updates.length > COMPACT_ABOVE) {
      compact(id, doc, held.through).catch(() => {
        // A merge that does not land changes nothing: the updates it would have
        // replaced are all still there, and the next opening tries again.
      });
    }
  };

  const ready = reconcile();

  doc.on("update", onUpdate);

  return {
    ready,
    status: () => status,
    resync: () => reconcile().catch(() => {}),
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      doc.off("update", onUpdate);
    },
  };
}

/**
 * Whether an encoded update carries any change at all.
 *
 * `encodeStateAsUpdate` against a state vector that already covers everything
 * returns a well-formed update with nothing in it, and posting one of those
 * would be a round trip that says nothing.
 */
function holdsSomething(update: Uint8Array): boolean {
  // An empty update is the two zero-length sections it is made of and nothing
  // else. Anything with content is longer than that.
  return update.length > 2;
}

export { COMPACT_ABOVE, REMOTE, RETRY_MS, SETTLE_MS, sync };
export type { Status, Sync, SyncState };

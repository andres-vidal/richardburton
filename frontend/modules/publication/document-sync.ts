import * as Y from "yjs";

import { isLocal, rowCount } from "./doc";
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

type Sync = {
  /** Everything the server holds has been applied, and anything only this machine held has been offered to it. */
  ready: Promise<void>;
  /**
   * Read the updates stored since the last read, and apply them.
   *
   * For coming back after being away. The relay does not keep what it passes
   * on, so the changes made while this client was unreachable were heard by
   * everyone else and can only be read back from storage. Until a first read
   * has succeeded there is nothing to read on from, so it makes that read
   * instead.
   */
  resync: () => Promise<void>;
  stop: () => void;
};

type Options = {
  /** Told whenever the state changes, and only then. */
  onStatus?: (state: SyncState) => void;
  /**
   * Settles once this browser's own copy has been read from disk.
   *
   * What the server is missing is measured after it, so that work restored from
   * disk is part of what is offered. Measured before it, a copy that loaded
   * slower than the server answered would hold offline work nothing offered.
   */
  loaded?: Promise<unknown>;
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
 * means the same thing. A change made here is an edit or an undo of one; see
 * `isLocal`. A change that arrived from the server carries its own origin, so
 * applying it cannot start a round trip back.
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
  { onStatus, loaded }: Options = {},
): Sync {
  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let state: SyncState = "saved";

  // How many posts have failed in a row, which paces the retry. Nobody else
  // needs it, and saying it would give every reader of the state a new value on
  // each failed attempt with nothing on screen to change.
  let failures = 0;

  // The id of the last stored update applied here, once the first read has
  // succeeded. Undefined until then.
  let through: number | undefined;

  const report = (next: SyncState) => {
    if (next === state) return;

    state = next;
    onStatus?.(state);
  };

  /** How long to wait after this many failures, doubling up to the ceiling. */
  const backoff = () =>
    Math.min(RETRY_MS * 2 ** Math.max(failures - 1, 0), MAX_RETRY_MS);

  const schedule = (delay: number) => {
    if (stopped || timer !== undefined) return;

    timer = setTimeout(flush, delay);
  };

  const flush = async () => {
    timer = undefined;

    if (pending.length === 0 || stopped) return;

    // One update standing for all of them, which is what the server would have
    // held anyway had they arrived separately. Kept merged if it has to wait, so
    // a retry does not merge the whole backlog again.
    const sending = Y.mergeUpdates(pending);
    pending = [];

    try {
      await append(id, sending, rowCount(doc));

      if (stopped) return;

      failures = 0;
      report(pending.length > 0 ? "saving" : "saved");

      if (pending.length > 0) schedule(SETTLE_MS);
    } catch {
      // The change is still in the document, so the next post carries it. A
      // document that cannot reach the server is one being edited offline, not
      // one that has lost anything.
      pending = [sending, ...pending];

      if (stopped) return;

      failures += 1;
      report("offline");
      schedule(backoff());
    }
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (!isLocal(origin)) return;

    pending.push(update);
    if (state !== "offline") report("saving");
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
    const [held] = await Promise.all([updates(id), loaded]);

    // Merged rather than applied one by one: the observer that writes the
    // document into the atoms runs per transaction, and rebuilding every list
    // for each update of a document read in hundreds of them is most of the
    // cost of opening one. The merge also says what the server holds, so that
    // is not paid for twice.
    const merged = Y.mergeUpdates(held.updates);
    Y.applyUpdate(doc, merged, REMOTE);

    if (stopped) return;

    through = Math.max(through ?? 0, held.through);

    const missing = Y.encodeStateAsUpdate(
      doc,
      Y.encodeStateVectorFromUpdate(merged),
    );

    // An update with nothing in it is its two empty sections and no more.
    if (missing.length > 2) {
      pending.push(missing);
      report("saving");
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

  /**
   * Apply what was stored after the last read. Anything this machine wrote in
   * the meantime is already in the post queue, so there is nothing to offer
   * back.
   */
  const catchUp = async () => {
    if (through === undefined) return reconcile();

    const held = await updates(id, through);

    if (stopped) return;

    if (held.updates.length > 0) {
      Y.applyUpdate(doc, Y.mergeUpdates(held.updates), REMOTE);
    }

    through = Math.max(through, held.through);
  };

  const ready = reconcile();

  doc.on("update", onUpdate);

  return {
    ready,
    resync: () => catchUp().catch(() => {}),
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      doc.off("update", onUpdate);
    },
  };
}

export { RETRY_MS, SETTLE_MS, sync };
export type { Sync, SyncState };

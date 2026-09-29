import * as Y from "yjs";

import { isLocal, rowCount } from "./doc";
import { append, compact, updates } from "./document-remote";

/**
 * The transaction origin for updates read from the server.
 *
 * `isLocal` returns false for it, so these updates are not posted back to the
 * server, and the undo manager does not track them.
 */
const REMOTE = Symbol("remote");

/** How long to collect changes before posting them, in milliseconds. */
const SETTLE_MS = 400;

/**
 * The delay before the first retry of a failed post, in milliseconds. It
 * doubles with each failure, up to `MAX_RETRY_MS`.
 */
const RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * The number of stored updates above which opening a document compacts them.
 *
 * Opening a document applies every stored update, so a document with many
 * updates opens slowly. Below this number, compacting is not worth the extra
 * request.
 */
const COMPACT_ABOVE = 200;

/**
 * The save state of a document's local changes.
 *
 * `saved` means the server has every local change. `saving` means some local
 * changes have not been posted yet. `offline` means a post failed and is
 * waiting to be retried. In every state the changes are kept in the document.
 */
type SyncState = "saved" | "saving" | "offline";

type Sync = {
  /**
   * Settles once the server's updates have been applied and any changes only
   * this client held have been queued for posting.
   */
  ready: Promise<void>;
  /**
   * Reads the updates stored since the last read and applies them.
   *
   * It is called when the channel reconnects, because the channel does not
   * store the changes it relays. Before any read has succeeded, it makes the
   * full first read instead, as on opening.
   */
  resync: () => Promise<void>;
  stop: () => void;
};

type Options = {
  /** Called each time the state changes, and only then. */
  onStatus?: (state: SyncState) => void;
  /**
   * Settles once this browser's copy has been read from IndexedDB.
   *
   * The first read waits for it before working out what the server is
   * missing, so work restored from IndexedDB is posted even when it loads after
   * the server answers.
   */
  loaded?: Promise<unknown>;
};

/**
 * Posts a document's local changes to the server, and applies the server's
 * stored updates to the document.
 *
 * On opening, it reads every stored update and applies them. It then queues
 * for posting whatever the document holds that the server does not. That
 * includes work done while the server was unreachable, which is in IndexedDB
 * but not in the post queue.
 *
 * After that, each local change is posted as a Yjs update. A local change is
 * an edit, an undo or a redo; see `isLocal`. Changes are collected for
 * `SETTLE_MS` and merged with `Y.mergeUpdates`, so a burst of typing is sent in
 * one request. Updates applied from the server have the origin `REMOTE`, so
 * they are not posted back.
 *
 * Editing never waits for the server. A slow connection only delays the save.
 * A failed post is retried after a delay that doubles each time, without
 * waiting for another edit, since the person may have finished editing.
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

  // The number of posts that have failed in a row, used for the retry delay.
  // It is not part of `SyncState`, because reporting it would give every reader
  // of the state a new value on each failed attempt without changing what they
  // show.
  let failures = 0;

  // The id of the last stored update applied here, once the first read has
  // succeeded. Undefined until then.
  let through: number | undefined;

  const report = (next: SyncState) => {
    if (next === state) return;

    state = next;
    onStatus?.(state);
  };

  /**
   * The retry delay for the current number of failures: `RETRY_MS`, doubled for
   * each failure after the first, up to `MAX_RETRY_MS`.
   */
  const backoff = () =>
    Math.min(RETRY_MS * 2 ** Math.max(failures - 1, 0), MAX_RETRY_MS);

  const schedule = (delay: number) => {
    if (stopped || timer !== undefined) return;

    timer = setTimeout(flush, delay);
  };

  const flush = async () => {
    timer = undefined;

    if (pending.length === 0 || stopped) return;

    // The pending updates are merged into one, which holds the same changes. If
    // the post fails, the merged update is queued again as it is, so a retry
    // does not merge the backlog again.
    const sending = Y.mergeUpdates(pending);
    pending = [];

    try {
      await append(id, sending, rowCount(doc));

      if (stopped) return;

      failures = 0;
      report(pending.length > 0 ? "saving" : "saved");

      if (pending.length > 0) schedule(SETTLE_MS);
    } catch {
      // The failed update goes back to the front of the queue, so the next post
      // carries it. Nothing is lost while the server is unreachable.
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
   * Reads every stored update, applies them, and queues for posting whatever
   * the document holds beyond them. It also compacts the stored updates when
   * there are more than `COMPACT_ABOVE`.
   *
   * The server's updates are applied with the origin `REMOTE`, so `onUpdate`
   * does not post them. Work restored from IndexedDB is applied with an origin
   * of its own, so `onUpdate` does not post it either. This function is what
   * posts it.
   */
  const reconcile = async () => {
    const [held] = await Promise.all([updates(id), loaded]);

    // The updates are merged and applied in one transaction. The store's
    // observer runs once per transaction and rebuilds every list, so applying
    // hundreds of updates one by one would make opening slow. The merged update
    // is also used below to work out what the server holds.
    const merged = Y.mergeUpdates(held.updates);
    Y.applyUpdate(doc, merged, REMOTE);

    if (stopped) return;

    through = Math.max(through ?? 0, held.through);

    const missing = Y.encodeStateAsUpdate(
      doc,
      Y.encodeStateVectorFromUpdate(merged),
    );

    // An empty Yjs update is two bytes long, so a longer one holds changes.
    if (missing.length > 2) {
      pending.push(missing);
      report("saving");
      schedule(0);
    }

    // Compacting here, rather than on a timer, runs it at most once per
    // opening, right after reading the updates it replaces.
    if (held.updates.length > COMPACT_ABOVE) {
      compact(id, doc, held.through).catch(() => {
        // A failed compaction changes nothing on the server. The updates stay
        // as they were, and the next opening tries again.
      });
    }
  };

  /**
   * Reads the updates stored after `through` and applies them. Local changes
   * made in the meantime are already in the post queue, so nothing is queued
   * here. Before the first successful read, it runs `reconcile` instead.
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

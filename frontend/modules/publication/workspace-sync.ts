import * as Y from "yjs";

import { LOCAL, keys } from "./doc";
import { append, updates } from "./workspace-remote";

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

type Sync = {
  /** Everything the server holds has been applied. */
  ready: Promise<void>;
  stop: () => void;
};

/**
 * Keep a workspace's document and the server's copy of it in step.
 *
 * On opening, everything the server holds is applied. After that, each change
 * made here is posted as the opaque bytes it is. Changes are gathered for a
 * moment first, so a burst of typing is one request rather than one per
 * keystroke — Yjs merges them into a single update that means the same thing.
 *
 * Only changes made here are posted. A change that arrived from the server
 * carries its own origin, so applying it cannot start a round trip back.
 *
 * Nothing here blocks editing. The document needs no authority to accept a
 * change, so a slow connection makes the workspace save late rather than
 * stall, and a failed post leaves the change in the document to be carried by
 * the next one.
 */
function sync(doc: Y.Doc, id: number): Sync {
  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const flush = async () => {
    timer = undefined;

    const sending = pending;
    pending = [];

    if (sending.length === 0 || stopped) return;

    try {
      // One update standing for all of them, which is what the server would
      // have held anyway had they arrived separately.
      await append(id, Y.mergeUpdates(sending), keys(doc).length);
    } catch {
      // The change is still in the document, so the next post carries it. A
      // workspace that cannot reach the server is a workspace being edited
      // offline, not a workspace that has lost anything.
      pending = [...sending, ...pending];
    }
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== LOCAL) return;

    pending.push(update);
    if (timer === undefined) timer = setTimeout(flush, SETTLE_MS);
  };

  const ready = updates(id).then((held) => {
    // Applied under the remote origin, so none of it is posted back and none of
    // it lands in this person's undo.
    held.forEach((update) => Y.applyUpdate(doc, update, REMOTE));
  });

  doc.on("update", onUpdate);

  return {
    ready,
    stop: () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      doc.off("update", onUpdate);
    },
  };
}

export { REMOTE, SETTLE_MS, sync };
export type { Sync };

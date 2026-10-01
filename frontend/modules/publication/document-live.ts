import { Presence, Socket } from "phoenix";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";

import { API_URL } from "app";
import { csrfToken } from "modules/http";
import { isLocal } from "./doc";
import { decode, encode } from "./document-remote";

/**
 * The transaction origin for updates received on the channel.
 *
 * It is separate from `REMOTE` in document-sync.ts, the origin of stored
 * updates, but has the same effect. `isLocal` returns false for it, so the
 * update is not sent to the server or the channel again, and the undo manager
 * does not track it.
 */
const RELAYED = Symbol("relayed");

/**
 * The state of a document's live connection.
 *
 * `connecting` means the socket is opening for the first time or reconnecting
 * after a drop. In both cases changes are not being relayed yet. `live` means
 * the channel is joined. `offline` means the socket or the channel failed, or
 * the server refused the channel.
 */
type LiveState = "connecting" | "live" | "offline";

/**
 * The connections that have this document open, as Phoenix Presence on the
 * server tracks them.
 *
 * `connections` maps each connection's awareness client id to the email the
 * server holds for its user. `subscribe` registers a listener that is called
 * when the list changes. The server builds the list, so a client cannot list
 * itself under another email, and a connection leaves the list when its socket
 * closes.
 */
type PresenceList = {
  subscribe: (listener: () => void) => () => void;
  connections: () => Map<number, string>;
};

/**
 * Returns the socket URL: `API_URL` with a trailing `/api` replaced by
 * `/socket`.
 */
function socketUrl(): string {
  const api = API_URL ?? "";

  // The API is served under `/api` on the same host as the socket.
  return `${api.replace(/\/api\/?$/, "")}/socket`;
}

type Live = {
  /** Each connection's focused cell, shared through Yjs awareness. */
  awareness: Awareness;
  /** The connections that have the document open. */
  presence: PresenceList;
  stop: () => void;
};

type Hooks = {
  /** Called each time the connection reports a state. */
  onStatus?: (state: LiveState) => void;
  /**
   * Called when the channel is joined again after the connection dropped. It
   * should read the stored updates again. `live` waits for what it returns
   * before sending a `sync` message, so the others send only the changes that
   * are not stored yet.
   *
   * The channel does not keep the updates it relays. Changes relayed while this
   * client was disconnected can only be read from the stored updates or asked
   * for with `sync`.
   */
  onRejoin?: () => unknown;
  /**
   * Settles once the stored updates have been applied. The first `sync`
   * message after joining waits for it, for the same reason as `onRejoin`.
   */
  ready?: Promise<unknown>;
};

/**
 * Relays changes to a document between everyone who has it open, over the
 * `document:<id>` channel.
 *
 * Each local change is pushed as an `update` message holding the Yjs update
 * bytes, and each `update` received is applied to `doc`. The channel does not
 * store updates. `sync` in document-sync.ts posts them to the server. Updates
 * relayed while the connection is down are missed, so after a rejoin `live`
 * calls `onRejoin` to read the stored updates again.
 *
 * The stored updates can also miss changes. A change made just before this
 * client joined may have been relayed before it joined and not be stored yet.
 * Work restored from this browser's IndexedDB is posted to the server but never
 * relayed. So after each join the clients exchange Yjs state vectors. A state
 * vector records which changes a document holds. This client sends its own in
 * a `sync` message. Each client already in the channel replies with the
 * changes this client lacks and with its own state vector. This client then
 * replies to each of those with the changes that client lacks.
 *
 * Presence comes from the server and lists the connections that have the
 * document open. Awareness comes from each client and holds its focused cell.
 * This client removes the awareness state of any connection that presence no
 * longer lists. When a new connection appears, this client sends its own
 * awareness state again, because awareness is only sent when it changes.
 *
 * The socket is authenticated by the `rb-session` cookie, which the browser
 * sends with the connect request. The cookie is httpOnly, so scripts on the
 * page cannot read it. The CSRF token from the `csrf-token` cookie is sent in
 * the auth-token header, not in the URL. The server refuses a connection
 * without it, so a page on another origin cannot connect with this session.
 */
function live(
  doc: Y.Doc,
  id: number,
  { onStatus, onRejoin, ready }: Hooks = {},
): Live {
  const awareness = new Awareness(doc);

  const socket = new Socket(socketUrl(), { authToken: csrfToken() });
  const channel = socket.channel(`document:${id}`, { clientId: doc.clientID });
  let stopped = false;
  let joined = false;

  let connections = new Map<number, string>();
  const listeners = new Set<() => void>();

  const presence: PresenceList = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connections: () => connections,
  };

  const report = (state: LiveState) => {
    if (!stopped) onStatus?.(state);
  };

  // Only local changes are pushed to the channel. A change that came from the
  // stored updates or from the channel has another origin and is not pushed
  // again, since the other clients get it the same way.
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (!isLocal(origin)) return;

    channel.push("update", { update: encode(update) });
  };

  /**
   * Sends this client's state vector in a `sync` message. Each other client
   * replies with the changes this client lacks and with its own state vector.
   * See `onSync`.
   */
  const exchange = () => {
    channel.push("sync", {
      state: encode(Y.encodeStateVector(doc)),
      from: doc.clientID,
    });
  };

  /**
   * Replies to a `sync` message with an `update` holding the changes its
   * sender lacks.
   *
   * A message with no `to` comes from a client that has just joined. This
   * client also replies to it with its own state vector, addressed `to` that
   * client, so that the new client sends back the changes only it holds. A
   * message addressed to another client is ignored.
   */
  const onSync = ({
    state,
    from,
    to,
  }: {
    state: string;
    from: number;
    to?: number;
  }) => {
    if (to !== undefined && to !== doc.clientID) return;

    const missing = Y.encodeStateAsUpdate(doc, decode(state));

    // An empty Yjs update is two bytes long, so a longer one holds changes.
    if (missing.length > 2) {
      channel.push("update", { update: encode(missing) });
    }

    if (to === undefined) {
      channel.push("sync", {
        state: encode(Y.encodeStateVector(doc)),
        from: doc.clientID,
        to: from,
      });
    }
  };

  /** Sends this client's awareness state to the channel. */
  const announce = () => {
    channel.push("awareness", {
      awareness: encode(encodeAwarenessUpdate(awareness, [doc.clientID])),
    });
  };

  // Only this client's own awareness state is sent. Awareness also changes when
  // another client's state arrives or is removed. Sending on those changes
  // would make every client resend every other client's cursor.
  const onAwareness = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    const mine = [...added, ...updated, ...removed].includes(doc.clientID);

    if (mine) announce();
  };

  /**
   * Stores the connections presence lists and notifies `presence` listeners.
   * It removes the awareness state of every connection that is no longer
   * listed, and sends this client's awareness state again when a new
   * connection has appeared.
   */
  const onPresence = (next: Map<number, string>) => {
    const arrived = [...next.keys()].some(
      (clientId) => clientId !== doc.clientID && !connections.has(clientId),
    );

    connections = next;

    const gone = [...awareness.getStates().keys()].filter(
      (clientId) => clientId !== doc.clientID && !next.has(clientId),
    );

    if (gone.length > 0) removeAwarenessStates(awareness, gone, "left");
    if (arrived) announce();

    listeners.forEach((listener) => listener());
  };

  report("connecting");

  socket.onError(() => report("offline"));
  socket.onClose(() => {
    if (!stopped) report("connecting");
  });

  socket.connect();

  channel.on("update", ({ update }: { update: string }) =>
    Y.applyUpdate(doc, decode(update), RELAYED),
  );

  channel.on("awareness", ({ awareness: state }: { awareness: string }) =>
    applyAwarenessUpdate(awareness, decode(state), RELAYED),
  );

  channel.on("sync", onSync);

  // The server pushes `refused` when this session may no longer have the
  // document open, because it was signed out or its user lost access. The
  // server then closes the channel and refuses any rejoin.
  channel.on("refused", () => report("offline"));

  const tracked = new Presence(channel);

  tracked.onSync(() => {
    const next = new Map<number, string>();

    tracked.list((_person, { metas }) =>
      metas.forEach(
        ({ client_id, email }: { client_id?: number; email?: string }) => {
          if (typeof client_id === "number" && email) {
            next.set(client_id, email);
          }
        },
      ),
    );

    onPresence(next);
  });

  channel.onError(() => report("offline"));

  channel
    .join()
    .receive("ok", () => {
      report("live");
      announce();

      // On the first join, `ready` covers the stored updates, which `sync`
      // reads on opening. On a rejoin, `onRejoin` reads them again.
      const caughtUp = joined ? onRejoin?.() : ready;
      joined = true;

      Promise.resolve(caughtUp)
        .catch(() => {})
        .then(() => {
          if (!stopped) exchange();
        });
    })
    .receive("error", () => report("offline"))
    .receive("timeout", () => report("offline"));

  doc.on("update", onUpdate);
  awareness.on("update", onAwareness);

  return {
    awareness,
    presence,
    stop: () => {
      stopped = true;
      doc.off("update", onUpdate);

      // The awareness state is removed before `onAwareness` is detached, so
      // the removal is still sent to the channel. The other clients then drop
      // this cursor at once, instead of when presence reports the connection
      // gone.
      removeAwarenessStates(awareness, [doc.clientID], "left");
      awareness.off("update", onAwareness);
      awareness.destroy();
      listeners.clear();

      channel.leave();
      socket.disconnect();
    },
  };
}

export { live };
export type { Live, LiveState, PresenceList };

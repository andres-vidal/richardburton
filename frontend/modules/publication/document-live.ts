import { Presence, Socket, type Channel } from "phoenix";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";

import { API_URL, request } from "app";
import { isLocal } from "./doc";
import { decode, encode } from "./document-remote";

/**
 * The origin stamped on a change that arrived over the wire.
 *
 * Distinct from the one the stored updates carry, but used the same way: a
 * change that came from elsewhere is not posted back, and is not this person's
 * to undo.
 */
const RELAYED = Symbol("relayed");

/**
 * Whether this document is hearing from anyone else.
 *
 * `connecting` covers both opening the connection and getting it back, because
 * from where the reader sits those are the same thing: changes are not crossing
 * yet, and something is being done about it.
 */
type LiveState = "connecting" | "live" | "offline";

/**
 * Who has this document open, as the server tracks it.
 *
 * Each open connection by the awareness id its client uses, with the address
 * the server holds for whoever it belongs to. The server keeps this, not the
 * clients, so nobody is shown here on their own say-so and nobody lingers after
 * their tab is gone.
 */
type PresenceList = {
  subscribe: (listener: () => void) => () => void;
  connections: () => Map<number, string>;
};

/** Where the socket lives, derived from wherever the API is. */
function socketUrl(): string {
  const api = API_URL ?? "";

  // The API is served under `/api` on the same host as the socket.
  return `${api.replace(/\/api\/?$/, "")}/socket`;
}

/** A token to open a connection with, minted behind the session cookie. */
async function socketToken(): Promise<string> {
  return request(async (http) => {
    const { data } = await http.post<{ token: string }>(
      "documents/socket-token",
    );

    return data.token;
  });
}

type Live = {
  /** Where each person here is looking. */
  awareness: Awareness;
  /** Who is here. */
  presence: PresenceList;
  stop: () => void;
};

type Hooks = {
  /** Called whenever the connection changes state. */
  onStatus?: (state: LiveState) => void;
  /**
   * Called when the connection comes back after being away, to read the stored
   * updates again. What it returns is awaited before the others are asked what
   * this client is missing, so they send only what is not stored yet.
   *
   * Changes are relayed and not kept, so the ones relayed while this client was
   * away can only be read back from storage, or asked of the others.
   */
  onRejoin?: () => unknown;
  /**
   * Settles once the stored updates have been applied. The first time this
   * client asks the others what it is missing waits for it, for the same reason.
   */
  ready?: Promise<unknown>;
};

/**
 * Keep this document in step with the people who have it open.
 *
 * Changes cross as the opaque bytes they already are, so this is a transport
 * for what is being written down anyway rather than a second way of recording
 * it. A connection that drops is a gap: the changes relayed while it was down
 * were heard by everyone else and not by this client, so coming back asks for
 * the stored updates again rather than picking up where it left off.
 *
 * The stored updates do not hold everything, though. A change somebody made
 * moments before this client joined was relayed before this client could hear
 * it, and may not be stored yet. Work this client restored from its own disk is
 * stored when it opens, but never relayed. So every join ends with an exchange
 * of state vectors, a state vector being the summary Yjs keeps of which changes
 * a document holds. This client sends its own. Everyone already here answers
 * with the changes it lacks and with a state vector of theirs, and this client
 * answers each of those with the changes that one lacks.
 *
 * Two things say who is here. Presence, from the server, says who has the
 * document open. Awareness, from each client, says where their cursor is, and
 * is kept to the connections presence names: a cursor belonging to a
 * connection the server no longer has is taken away, and somebody arriving is
 * greeted by this client saying where it is, since awareness is only sent when
 * it changes.
 *
 * The connection is authorised by a token that names this session and rides a
 * header rather than the address. It is minted once: the server asks on every
 * connect whether the session still stands, so an old token keeps nobody in.
 */
function live(
  doc: Y.Doc,
  id: number,
  { onStatus, onRejoin, ready }: Hooks = {},
): Live {
  const awareness = new Awareness(doc);

  let socket: Socket | undefined;
  let channel: Channel | undefined;
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

  // Only a change made here crosses to the others. One that arrived, from the
  // stored updates or from somebody else, carries its own origin, so relaying it
  // back would put it round the room for ever.
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (!isLocal(origin)) return;

    channel?.push("update", { update: encode(update) });
  };

  /**
   * Ask everyone already here for what this client is missing, and let them say
   * what they are missing in turn; see `onSync`.
   */
  const exchange = () => {
    channel?.push("sync", {
      state: encode(Y.encodeStateVector(doc)),
      from: doc.clientID,
    });
  };

  /**
   * Answer a state vector with the changes its sender lacks.
   *
   * One with no `to` is somebody joining, and is also answered with this
   * client's own state vector, so that they send back whatever only they hold.
   * One addressed to another client is theirs to answer.
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

    // An update with nothing in it is its two empty sections and no more.
    if (missing.length > 2) {
      channel?.push("update", { update: encode(missing) });
    }

    if (to === undefined) {
      channel?.push("sync", {
        state: encode(Y.encodeStateVector(doc)),
        from: doc.clientID,
        to: from,
      });
    }
  };

  /** Say where this client is looking. */
  const announce = () => {
    channel?.push("awareness", {
      awareness: encode(encodeAwarenessUpdate(awareness, [doc.clientID])),
    });
  };

  // Only what this client says about itself goes out. Awareness also changes
  // when somebody else's arrives or leaves, and passing that on would have every
  // client repeat every other one's cursor to the whole room.
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

  /** Bring awareness into line with who the server says is here. */
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

  socketToken()
    .then((token) => {
      if (stopped) return;

      socket = new Socket(socketUrl(), { authToken: token });

      socket.onError(() => report("offline"));
      socket.onClose(() => {
        if (!stopped) report("connecting");
      });

      socket.connect();

      channel = socket.channel(`document:${id}`, { clientId: doc.clientID });

      channel.on("update", ({ update }: { update: string }) =>
        Y.applyUpdate(doc, decode(update), RELAYED),
      );

      channel.on("awareness", ({ awareness: state }: { awareness: string }) =>
        applyAwarenessUpdate(awareness, decode(state), RELAYED),
      );

      channel.on("sync", onSync);

      // The server has decided this session may no longer have the document
      // open: it was signed out of, or its person lost access. It closes the
      // channel straight after, and does not let it back.
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

          // The stored updates are read again only on getting the connection
          // back: the first join is read by another route, which `ready` is.
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
    })
    .catch((reason) => {
      // Editing goes on without it: changes still save, and what was missed
      // arrives when the document is next opened. But a document that is
      // quietly not live looks exactly like one nobody else is editing, so it
      // says so rather than failing silently.
      report("offline");
      console.warn("This document is not receiving live changes.", reason);
    });

  return {
    awareness,
    presence,
    stop: () => {
      stopped = true;
      doc.off("update", onUpdate);

      // Said before the handler that carries it is taken away, so the others
      // lose this cursor now rather than when the server notices the
      // connection has gone.
      removeAwarenessStates(awareness, [doc.clientID], "left");
      awareness.off("update", onAwareness);
      awareness.destroy();
      listeners.clear();

      channel?.leave();
      socket?.disconnect();
    },
  };
}

export { live };
export type { Live, LiveState, PresenceList };
